import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ listGoogleDriveSources: vi.fn(), listGoogleDriveSourceRecords: vi.fn(), getGoogleDriveSource: vi.fn() }));
const drive = vi.hoisted(() => ({ createDriveAuthorizationUrl: vi.fn((input) => input), listDriveFiles: vi.fn() }));
vi.mock("../server/db", () => ({ ...db, upsertGoogleDriveSource: vi.fn() }));
vi.mock("../server/googleDrive", () => ({ ...drive }));
import { appRouter } from "../server/routers";
import { createDriveAccessGrant, createGallerySession, verifyGallerySession } from "../server/session";

const req = { headers: {}, header: () => undefined, query: {}, protocol: "http", get: () => "localhost:3000" } as any;
const res = {} as any;

describe("server-owned Gallery sessions", () => {
  beforeEach(() => { process.env.JWT_SECRET = "session-test-secret"; process.env.GALLERY_WEB_RETURN_ORIGINS = "http://localhost:8081"; vi.clearAllMocks(); db.listGoogleDriveSources.mockResolvedValue([]); db.listGoogleDriveSourceRecords.mockResolvedValue([]); });
  it("rejects Drive access without an authenticated server session", async () => { await expect(appRouter.createCaller({ req, res, session: null }).googleDrive.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" }); });
  it("derives source ownership from the verified session, never caller input", async () => { const first = createGallerySession(); const second = createGallerySession(); await appRouter.createCaller({ req, res, session: verifyGallerySession(first.token) }).googleDrive.list(); await appRouter.createCaller({ req, res, session: verifyGallerySession(second.token) }).googleDrive.list(); expect(db.listGoogleDriveSources.mock.calls.map(([owner]) => owner)).toEqual([first.session.ownerId, second.session.ownerId]); });
  it("binds OAuth state to the authenticated owner", async () => { const created = createGallerySession(); await appRouter.createCaller({ req, res, session: created.session }).googleDrive.beginConnect({ returnUri: "http://localhost:8081/oauth/drive" }); expect(drive.createDriveAuthorizationUrl).toHaveBeenCalledWith(expect.objectContaining({ ownerId: created.session.ownerId })); });
  it("isolates a failed Drive while returning healthy sources", async () => { const session = createGallerySession().session; db.listGoogleDriveSourceRecords.mockResolvedValue([{ id: 1, displayName: "A", email: null, refreshTokenEncrypted: "good" }, { id: 2, displayName: "B", email: null, refreshTokenEncrypted: "bad" }]); drive.listDriveFiles.mockImplementation((token: string) => token === "good" ? Promise.resolve([{ id: "ok" }]) : Promise.reject(new Error("revoked"))); const groups = await appRouter.createCaller({ req, res, session }).googleDrive.files(); expect(groups.map((group) => group.status)).toEqual(["available", "unavailable"]); expect(groups[0]?.files).toHaveLength(1); });
});

it("media lookup cannot cross session ownership", async () => {
  const { registerGoogleDriveRoutes } = await import("../server/googleDriveRoutes");
  const handlers = new Map<string, Function>();
  registerGoogleDriveRoutes({ get: (path: string, handler: Function) => { handlers.set(path, handler); } } as any);
  const owner = createGallerySession(); const other = createGallerySession(); const grant = createDriveAccessGrant({ ownerId: other.session.ownerId, sourceId: 7, fileId: "drive-file", kind: "media" });
  db.getGoogleDriveSource.mockResolvedValue(null);
  const response = { status: vi.fn().mockReturnThis(), send: vi.fn(), setHeader: vi.fn(), end: vi.fn() };
  await handlers.get("/api/google-drive/media/:sourceId/:fileId")!({ headers: {}, header: () => undefined, query: { grant }, params: { sourceId: "7", fileId: "drive-file" } }, response);
  expect(db.getGoogleDriveSource).toHaveBeenCalledWith(other.session.ownerId, 7);
  expect(db.getGoogleDriveSource).not.toHaveBeenCalledWith(owner.session.ownerId, 7);
  expect(response.status).toHaveBeenCalledWith(404);
});
