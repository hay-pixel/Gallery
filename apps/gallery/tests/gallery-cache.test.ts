import { describe, expect, it } from "vitest";
import {
  createGalleryCacheStore,
  createInMemoryCacheIO,
  type CacheSlot,
} from "../lib/catalogue/cache-store";
import { createDeviceCacheIO } from "../lib/catalogue/device-cache";
import { createEmptyCatalogueSnapshot, snapshotFromFixtures } from "../lib/catalogue/fixture-adapter";

const VALID_ASSET_ID = "sha256:1b8f40e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0011";

describe("Gallery two-slot durable offline cache", () => {
  it("persists and restores a snapshot with 20,000 discovered sources across restart", async () => {
    const io = createInMemoryCacheIO();
    const store1 = createGalleryCacheStore(io);

    const snapshot = snapshotFromFixtures(true, "2026-10-06T00:00:00Z");
    snapshot.discovered_sources = Array.from({ length: 20_000 }, (_, i) => ({
      discoveryHandle: `handle:${i}`,
      providerKind: "local_media" as const,
      displayName: `IMG_${i}.JPG`,
      uri: `content://media/external/images/media/${i}`,
      mimeType: "image/jpeg",
      sizeBytes: 1024 + i,
      modifiedAt: "2026-10-06T00:00:00Z",
      accessState: "granted" as const,
    }));

    await store1.write(snapshot);

    // Simulate process restart by constructing a new store over the same IO state
    const store2 = createGalleryCacheStore(io);
    const restored = await store2.read();
    expect(restored).not.toBeNull();
    expect(restored?.discovered_sources).toHaveLength(20_000);
    expect(restored?.canonical_assets).toEqual(snapshot.canonical_assets);
    expect(restored?.source_occurrences).toEqual(snapshot.source_occurrences);
    expect(restored?.annotations).toEqual(snapshot.annotations);
  });

  it("preserves the last committed snapshot when an inactive slot write fails", async () => {
    const io = createInMemoryCacheIO();
    const store = createGalleryCacheStore(io);

    const first = snapshotFromFixtures(true, "2026-10-06T01:00:00Z");
    await store.write(first);

    io.failNextSlotWrite = true;
    const second = createEmptyCatalogueSnapshot("2026-10-06T02:00:00Z");
    await expect(store.write(second)).rejects.toThrow(/slot write failed/i);

    const restored = await store.read();
    expect(restored?.saved_at).toBe("2026-10-06T01:00:00Z");
    expect(restored?.canonical_assets).toHaveLength(first.canonical_assets.length);
  });

  it("preserves the last committed snapshot when pointer update fails after slot write", async () => {
    const io = createInMemoryCacheIO();
    const store = createGalleryCacheStore(io);

    const first = snapshotFromFixtures(true, "2026-10-06T01:00:00Z");
    await store.write(first);

    io.failNextPointerWrite = true;
    const second = createEmptyCatalogueSnapshot("2026-10-06T02:00:00Z");
    await expect(store.write(second)).rejects.toThrow(/pointer write failed/i);

    const restored = await store.read();
    expect(restored?.saved_at).toBe("2026-10-06T01:00:00Z");
    expect(restored?.canonical_assets).toHaveLength(first.canonical_assets.length);
  });

  it("serializes concurrent writes in call order", async () => {
    const io = createInMemoryCacheIO();
    const store = createGalleryCacheStore(io);

    const s1 = createEmptyCatalogueSnapshot("2026-10-06T01:00:00Z");
    const s2 = snapshotFromFixtures(true, "2026-10-06T02:00:00Z");
    const s3 = createEmptyCatalogueSnapshot("2026-10-06T03:00:00Z");
    s3.canonical_assets.push({
      schema: "asset-record",
      schema_version: 1,
      asset_id: VALID_ASSET_ID,
      content_hash: VALID_ASSET_ID,
      storage_locator: "/blobs/1b8f",
      mime_type: "image/jpeg",
      size_bytes: 512,
      processing_state: "ready",
    });

    await Promise.all([store.write(s1), store.write(s2), store.write(s3)]);
    const restored = await store.read();
    expect(restored?.saved_at).toBe("2026-10-06T03:00:00Z");
    expect(restored?.canonical_assets).toHaveLength(1);
  });

  it("falls back safely when pointer is corrupt or slot has unsupported schema", async () => {
    const io = createInMemoryCacheIO();
    const store = createGalleryCacheStore(io);

    const valid = snapshotFromFixtures(true, "2026-10-06T01:00:00Z");
    await store.write(valid);

    // Corrupt the pointer; store should fall back to scanning slots and picking the newest valid snapshot
    await io.writePointer("{corrupt-json");
    const recovered = await store.read();
    expect(recovered?.saved_at).toBe("2026-10-06T01:00:00Z");

    // Corrupt both slots with unsupported schema_version
    const badSlot: CacheSlot = "slot-a";
    await io.writeSlot(badSlot, JSON.stringify({ schema: "gallery-catalogue-cache", schema_version: 99 }));
    await io.writeSlot("slot-b", JSON.stringify({ schema: "gallery-catalogue-cache", schema_version: 99 }));
    expect(await store.read()).toBeNull();
  });

  it("migrates recognizable legacy cache state via device cache IO", async () => {
    const backing = new Map<string, string>();
    const legacySnapshot = snapshotFromFixtures(true, "2026-10-05T12:00:00Z");
    backing.set("gallery:catalogue:legacy-v0", JSON.stringify(legacySnapshot));

    const deviceIO = createDeviceCacheIO({
      getItem: async (k) => backing.get(k) ?? null,
      setItem: async (k, v) => {
        backing.set(k, v);
      },
      removeItem: async (k) => {
        backing.delete(k);
      },
    });

    const store = createGalleryCacheStore(deviceIO);
    const migrated = await store.read();
    expect(migrated?.saved_at).toBe("2026-10-05T12:00:00Z");
    expect(backing.has("gallery:catalogue:legacy-v0")).toBe(false);
  });
});

