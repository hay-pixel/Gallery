import crypto from "node:crypto";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE_ABOUT_URL = "https://www.googleapis.com/drive/v3/about?fields=user(permissionId,emailAddress,displayName)";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
export const DRIVE_VIEW_SCOPE = "https://www.googleapis.com/auth/drive.readonly";

type OAuthState = { ownerId: string; returnUri: string; nonce: string; expiresAt: number };
type TokenResponse = { access_token?: string; refresh_token?: string; scope?: string; expires_in?: number; error?: string; error_description?: string };

function required(name: "GOOGLE_DRIVE_OAUTH_CLIENT_ID" | "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function stateKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required to protect OAuth state and connected-source tokens");
  return crypto.createHash("sha256").update(secret).digest();
}

function encode(value: Buffer | string) { return Buffer.from(value).toString("base64url"); }

export function createDriveAuthorizationUrl(input: { ownerId: string; returnUri: string; redirectUri: string }) {
  const payload: OAuthState = { ownerId: input.ownerId, returnUri: input.returnUri, nonce: crypto.randomUUID(), expiresAt: Date.now() + 10 * 60 * 1000 };
  const serialized = encode(JSON.stringify(payload));
  const signature = encode(crypto.createHmac("sha256", stateKey()).update(serialized).digest());
  const url = new URL(GOOGLE_AUTHORIZE_URL);
  url.searchParams.set("client_id", required("GOOGLE_DRIVE_OAUTH_CLIENT_ID"));
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DRIVE_VIEW_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", `${serialized}.${signature}`);
  return url.toString();
}

export function verifyDriveOAuthState(state: string): OAuthState {
  const [serialized, receivedSignature] = state.split(".");
  if (!serialized || !receivedSignature) throw new Error("Invalid OAuth state");
  const expectedSignature = crypto.createHmac("sha256", stateKey()).update(serialized).digest();
  const actualSignature = Buffer.from(receivedSignature, "base64url");
  if (actualSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(actualSignature, expectedSignature)) throw new Error("Invalid OAuth state signature");
  const payload = JSON.parse(Buffer.from(serialized, "base64url").toString("utf8")) as OAuthState;
  if (!/^[a-f0-9-]{36}$/i.test(payload.ownerId) || !payload.returnUri || payload.expiresAt < Date.now()) throw new Error("Expired OAuth state");
  return payload;
}

export async function exchangeDriveCode(code: string, redirectUri: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: required("GOOGLE_DRIVE_OAUTH_CLIENT_ID"),
      client_secret: required("GOOGLE_DRIVE_OAUTH_CLIENT_SECRET"),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const payload = await response.json() as TokenResponse;
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || "Google token exchange failed");
  if (!payload.refresh_token) throw new Error("Google did not return a refresh token. Reconnect and approve the consent prompt.");
  return { accessToken: payload.access_token, refreshToken: payload.refresh_token, scope: payload.scope || DRIVE_VIEW_SCOPE };
}

export async function getDriveIdentity(accessToken: string) {
  const response = await fetch(DRIVE_ABOUT_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  const payload = await response.json() as { user?: { permissionId?: string; emailAddress?: string; displayName?: string } };
  if (!response.ok || !payload.user?.permissionId) throw new Error("Could not read the linked Drive identity");
  return { providerAccountId: payload.user.permissionId, email: payload.user.emailAddress ?? null, displayName: payload.user.displayName || payload.user.emailAddress || "Google Drive" };
}

export function encryptRefreshToken(refreshToken: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", stateKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, "utf8"), cipher.final()]);
  return `${encode(iv)}.${encode(ciphertext)}.${encode(cipher.getAuthTag())}`;
}

export function decryptRefreshToken(encrypted: string) {
  const [encodedIv, encodedCiphertext, encodedTag] = encrypted.split(".");
  if (!encodedIv || !encodedCiphertext || !encodedTag) throw new Error("Invalid encrypted Drive token");
  const decipher = crypto.createDecipheriv("aes-256-gcm", stateKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encodedCiphertext, "base64url")), decipher.final()]).toString("utf8");
}

const accessTokenCache = new Map<string, { token: string; expiresAt: number }>();
export async function refreshDriveAccessToken(encryptedRefreshToken: string) {
  const cached = accessTokenCache.get(encryptedRefreshToken);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;
  const response = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: required("GOOGLE_DRIVE_OAUTH_CLIENT_ID"), client_secret: required("GOOGLE_DRIVE_OAUTH_CLIENT_SECRET"), grant_type: "refresh_token", refresh_token: decryptRefreshToken(encryptedRefreshToken) }) });
  const payload = await response.json() as TokenResponse;
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || "Google Drive token refresh failed");
  accessTokenCache.set(encryptedRefreshToken, { token: payload.access_token, expiresAt: Date.now() + Math.max(60, payload.expires_in ?? 3600) * 1000 });
  return payload.access_token;
}

export type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string; size?: string; description?: string; webViewLink?: string; thumbnailLink?: string };

export async function listDriveFiles(encryptedRefreshToken: string): Promise<DriveFile[]> {
  const accessToken = await refreshDriveAccessToken(encryptedRefreshToken);
  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(DRIVE_FILES_URL);
    url.searchParams.set("q", "trashed = false and mimeType != 'application/vnd.google-apps.folder'");
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("orderBy", "modifiedTime desc");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("fields", "nextPageToken,files(id,name,mimeType,modifiedTime,size,description,webViewLink,thumbnailLink)");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const payload = await response.json() as { files?: DriveFile[]; nextPageToken?: string; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message || "Could not list Google Drive files");
    files.push(...(payload.files ?? []));
    pageToken = payload.nextPageToken;
  } while (pageToken);
  return files;
}

export async function fetchDriveThumbnail(encryptedRefreshToken: string, fileId: string) {
  const accessToken = await refreshDriveAccessToken(encryptedRefreshToken);
  const metadataUrl = new URL(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`);
  metadataUrl.searchParams.set("fields", "thumbnailLink");
  metadataUrl.searchParams.set("supportsAllDrives", "true");
  const metadataResponse = await fetch(metadataUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
  const metadata = await metadataResponse.json() as { thumbnailLink?: string; error?: { message?: string } };
  if (!metadataResponse.ok || !metadata.thumbnailLink) throw new Error(metadata.error?.message || "Drive thumbnail is unavailable");
  const thumbnailUrl = new URL(metadata.thumbnailLink);
  if (thumbnailUrl.protocol !== "https:" || !thumbnailUrl.hostname.endsWith(".googleusercontent.com")) throw new Error("Unapproved Drive thumbnail host");
  thumbnailUrl.searchParams.set("sz", "w400-h400");
  return fetch(thumbnailUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
}

export async function fetchDriveMedia(encryptedRefreshToken: string, fileId: string, range?: string) {
  const accessToken = await refreshDriveAccessToken(encryptedRefreshToken);
  const url = new URL(`${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}`);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");
  return fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, ...(range ? { Range: range } : {}) } });
}
