import { createHash } from "crypto";

export type SessionStorageBackend = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export type GallerySessionStore = {
  readonly approvedOrigin: string | null;
  getToken(): Promise<string | null>;
  setToken(token: string): Promise<void>;
  clearToken(): Promise<void>;
};

function isLocalhostHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".localhost")
  );
}

export function validateApprovedApiOrigin(rawOrigin: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawOrigin);
  } catch {
    throw new Error(`Invalid Gallery API origin URL: ${rawOrigin}`);
  }

  if (parsed.username || parsed.password) {
    throw new Error("Gallery API origin must not contain embedded credentials");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`Unsupported Gallery API origin protocol: ${parsed.protocol}`);
  }

  if (parsed.protocol === "http:" && !isLocalhostHost(parsed.hostname)) {
    throw new Error("Remote Gallery API origins must use https:// (http:// is only allowed for localhost)");
  }

  return parsed.origin;
}

function buildSafeOriginStorageKey(normalizedOrigin: string): string {
  const digest = createHash("sha256")
    .update(`gallery-session-origin:${normalizedOrigin}`)
    .digest("hex")
    .slice(0, 32);
  return `gallery_session_v1_${digest}`;
}

export function createGallerySessionStore(
  storage: SessionStorageBackend,
  approvedApiOrigin: string | null | undefined,
): GallerySessionStore {
  const normalizedOrigin =
    approvedApiOrigin && approvedApiOrigin.trim().length > 0
      ? validateApprovedApiOrigin(approvedApiOrigin.trim())
      : null;

  const storageKey = normalizedOrigin ? buildSafeOriginStorageKey(normalizedOrigin) : null;

  return {
    approvedOrigin: normalizedOrigin,

    async getToken(): Promise<string | null> {
      if (!storageKey) {
        return null;
      }
      return storage.getItem(storageKey);
    },

    async setToken(token: string): Promise<void> {
      if (!storageKey) {
        throw new Error("Cannot store Gallery session before approved API origin is configured");
      }
      if (!token || token.trim().length === 0) {
        throw new Error("Session token must be non-empty");
      }
      await storage.setItem(storageKey, token);
    },

    async clearToken(): Promise<void> {
      if (!storageKey) {
        return;
      }
      await storage.removeItem(storageKey);
    },
  };
}

