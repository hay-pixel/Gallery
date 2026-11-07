import { describe, expect, it } from "vitest";
import {
  discoverLocalMediaSources,
  pickDocumentSources,
  verifySourceHandleAccess,
} from "../lib/sources/native";

describe("Gallery native source discovery", () => {
  it("returns denied or limited states honestly without fabricating canonical assets", async () => {
    const deniedPage = await discoverLocalMediaSources({
      getPermissionsAsync: async () => ({ status: "denied", accessPrivileges: "none", canAskAgain: true }),
      requestPermissionsAsync: async () => ({ status: "denied", accessPrivileges: "none", canAskAgain: false }),
      getAssetsAsync: async () => ({ assets: [], hasNextPage: false, endCursor: null }),
    });
    expect(deniedPage.accessState).toBe("denied");
    expect(deniedPage.items).toHaveLength(0);
    expect(deniedPage.hasNextPage).toBe(false);

    const limitedPage = await discoverLocalMediaSources({
      getPermissionsAsync: async () => ({ status: "granted", accessPrivileges: "limited", canAskAgain: true }),
      requestPermissionsAsync: async () => ({ status: "granted", accessPrivileges: "limited", canAskAgain: true }),
      getAssetsAsync: async () => ({
        assets: [
          {
            id: "media-42",
            filename: "IMG_0042.JPG",
            uri: "content://media/external/images/media/42",
            mediaType: "photo",
            modificationTime: 1728172800000,
          },
        ],
        hasNextPage: false,
        endCursor: "cursor-1",
      }),
    });
    expect(limitedPage.accessState).toBe("limited");
    expect(limitedPage.items).toHaveLength(1);
    expect(limitedPage.items[0]?.discoveryHandle).toContain("local_media:");
    expect((limitedPage.items[0] as Record<string, unknown>).asset_id).toBeUndefined();
    expect(limitedPage.items[0]?.linkedAssetId).toBeUndefined();
  });

  it("stops pagination when the provider returns an identical cursor", async () => {
    const page = await discoverLocalMediaSources(
      {
        getPermissionsAsync: async () => ({ status: "granted", accessPrivileges: "all", canAskAgain: true }),
        requestPermissionsAsync: async () => ({ status: "granted", accessPrivileges: "all", canAskAgain: true }),
        getAssetsAsync: async () => ({
          assets: [
            {
              id: "media-1",
              filename: "IMG_0001.JPG",
              uri: "content://media/external/images/media/1",
              mediaType: "photo",
            },
          ],
          hasNextPage: true,
          endCursor: "cursor-stuck",
        }),
      },
      "cursor-stuck",
    );

    expect(page.hasNextPage).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("never promotes a hash-like URI or provider ID to canonical asset_id", async () => {
    const hashLikeId = "sha256:1b8f40e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0011";
    const page = await discoverLocalMediaSources({
      getPermissionsAsync: async () => ({ status: "granted", accessPrivileges: "all", canAskAgain: true }),
      requestPermissionsAsync: async () => ({ status: "granted", accessPrivileges: "all", canAskAgain: true }),
      getAssetsAsync: async () => ({
        assets: [
          {
            id: hashLikeId,
            filename: `${hashLikeId}.jpg`,
            uri: `content://media/external/images/media/${hashLikeId}`,
            mediaType: "photo",
          },
        ],
        hasNextPage: false,
        endCursor: null,
      }),
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.discoveryHandle).not.toBe(hashLikeId);
    expect(page.items[0]?.linkedAssetId).toBeUndefined();
    expect((page.items[0] as Record<string, unknown>).asset_id).toBeUndefined();
  });

  it("handles document picker cancellation and selection as source-only items", async () => {
    const cancelled = await pickDocumentSources({
      getDocumentAsync: async () => ({ canceled: true, assets: null }),
    });
    expect(cancelled.items).toHaveLength(0);
    expect(cancelled.nextCursor).toBeNull();

    const selected = await pickDocumentSources({
      getDocumentAsync: async () => ({
        canceled: false,
        assets: [
          {
            name: "receipt.pdf",
            uri: "content://com.android.providers.downloads.documents/document/99",
            mimeType: "application/pdf",
            size: 12800,
          },
        ],
      }),
    });
    expect(selected.items).toHaveLength(1);
    expect(selected.items[0]?.providerKind).toBe("document_picker");
    expect(selected.items[0]?.linkedAssetId).toBeUndefined();
  });

  it("marks previously discovered source items as revoked when permission is lost after restart", async () => {
    const item = {
      discoveryHandle: "local_media:42",
      providerKind: "local_media" as const,
      displayName: "IMG_0042.JPG",
      uri: "content://media/external/images/media/42",
      mimeType: "image/jpeg",
      accessState: "granted" as const,
    };

    const rechecked = await verifySourceHandleAccess(item, {
      canReadUri: async () => false,
    });
    expect(rechecked.accessState).toBe("revoked");
  });
});

