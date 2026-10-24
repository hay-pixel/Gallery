import { describe, expect, it } from "vitest";
import {
  normaliseBackendUrl,
  searchDriveFiles,
  restoreLibraryState,
  safeExternalUrl,
  cacheDriveFiles,
} from "../lib/client-runtime";

describe("release client boundaries", () => {
  it("accepts HTTPS origins and rejects credentials, paths and insecure public endpoints", () => {
    expect(normaliseBackendUrl(" https://gallery.example.com/ ")).toBe(
      "https://gallery.example.com",
    );
    for (const url of [
      "http://gallery.example.com",
      "https://user:pass@example.com",
      "https://example.com/api",
      "https://example.com?key=secret",
    ])
      expect(() => normaliseBackendUrl(url)).toThrow();
    expect(normaliseBackendUrl("")).toBe("");
  });
  it("searches real source metadata without making provider IDs canonical", () => {
    const files = [
      {
        id: "42",
        name: "Lease.pdf",
        mimeType: "application/pdf",
        sourceId: 7,
        sourceName: "Housing Drive",
        description: "Tenancy agreement",
      },
    ];
    expect(searchDriveFiles(files, "tenancy")[0].id).toBe("42");
    expect(searchDriveFiles(files, "housing")[0].sourceId).toBe(7);
    expect(searchDriveFiles(files, "nothing")).toEqual([]);
  });
  it("opens an empty real library on first run and rejects inherited fixture state", () => {
    expect(restoreLibraryState(null)).toEqual({ files: [], chat: [] });
    expect(
      restoreLibraryState(JSON.stringify({ files: [{ assetId: "fixture" }] })),
    ).toEqual({ files: [], chat: [] });
    expect(restoreLibraryState("broken")).toEqual({ files: [], chat: [] });
  });
  it("never persists expiring media credentials in the offline metadata cache", () => {
    const cached = cacheDriveFiles([
      {
        id: "a",
        name: "photo.jpg",
        mimeType: "image/jpeg",
        sourceId: 1,
        sourceName: "Drive",
        mediaGrant: "secret",
        thumbnailGrant: "secret",
      },
    ]);
    expect(cached[0]).not.toHaveProperty("mediaGrant");
    expect(cached[0]).not.toHaveProperty("thumbnailGrant");
    expect(cached[0].name).toBe("photo.jpg");
  });
  it("rejects unsafe original links returned by a provider", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeExternalUrl("https://drive.google.com/file/d/42")).toBe(
      "https://drive.google.com/file/d/42",
    );
  });
});

describe("offline source degradation", () => {
  it("retains metadata for a failed source without reusing its media grants", async () => {
    const { mergeDriveAvailability } = await import("../lib/client-runtime");
    const cached = [
      {
        id: "old",
        name: "old.jpg",
        mimeType: "image/jpeg",
        sourceId: 1,
        sourceName: "Offline",
        mediaGrant: "expired",
      },
      {
        id: "deleted",
        name: "removed",
        mimeType: "text/plain",
        sourceId: 2,
        sourceName: "Online",
      },
    ];
    const live = [
      {
        id: "new",
        name: "new.jpg",
        mimeType: "image/jpeg",
        sourceId: 2,
        sourceName: "Online",
        mediaGrant: "fresh",
      },
    ];
    expect(mergeDriveAvailability(live, cached, [1])).toEqual([
      live[0],
      {
        id: "old",
        name: "old.jpg",
        mimeType: "image/jpeg",
        sourceId: 1,
        sourceName: "Offline",
      },
    ]);
  });
});
