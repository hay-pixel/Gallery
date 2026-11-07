import { describe, expect, it } from "vitest";
import { applyGalleryAnnotation } from "../lib/catalogue/annotations";
import { parseAssetRecordV1, parseSourceOccurrenceRecordV1 } from "../lib/catalogue/contracts";
import { createEmptyCatalogueSnapshot, snapshotFromFixtures } from "../lib/catalogue/fixture-adapter";
import { buildAllCatalogueAssetViews, buildCatalogueAssetView } from "../lib/catalogue/view-model";

const VALID_ASSET_ID = "sha256:1b8f40e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0011";
const OTHER_ASSET_ID = "sha256:2f6c40e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0042";
const OCC_ID_1 = "occurrence:sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OCC_ID_2 = "occurrence:sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe("Gallery canonical catalogue domain", () => {
  it("accepts asset-record v1 only when asset_id equals content_hash", () => {
    const valid = parseAssetRecordV1({
      schema: "asset-record",
      schema_version: 1,
      asset_id: VALID_ASSET_ID,
      content_hash: VALID_ASSET_ID,
      storage_locator: "/archive/blobs/1b8f40",
      mime_type: "image/jpeg",
      size_bytes: 3842108,
      processing_state: "ready",
    });
    expect(valid.asset_id).toBe(VALID_ASSET_ID);
    expect(valid.content_hash).toBe(VALID_ASSET_ID);

    expect(() =>
      parseAssetRecordV1({
        schema: "asset-record",
        schema_version: 1,
        asset_id: VALID_ASSET_ID,
        content_hash: OTHER_ASSET_ID,
        storage_locator: "/archive/blobs/1b8f40",
        mime_type: "image/jpeg",
        size_bytes: 3842108,
        processing_state: "ready",
      }),
    ).toThrow(/equal/i);
  });

  it("rejects paths provider ids and ui ids as asset identity", () => {
    for (const invalidId of [
      "Photos/2024/garage/speaker_wires_circled.jpg",
      "drive-photo-0001",
      "ui-card-1",
      "content://media/external/images/media/42",
      "SHA256:1B8F40E983A5320A7B2AA8F5B7C0CA7F8E7A77A2B20F5AA301D49B7A03BB0011",
    ]) {
      expect(() =>
        parseAssetRecordV1({
          schema: "asset-record",
          schema_version: 1,
          asset_id: invalidId,
          content_hash: invalidId,
          storage_locator: "/archive/blobs/x",
          mime_type: "image/jpeg",
          size_bytes: 100,
          processing_state: "ready",
        }),
      ).toThrow();
    }
  });

  it("accepts multiple source occurrences for one canonical asset", () => {
    const occ1 = parseSourceOccurrenceRecordV1({
      schema: "source-occurrence-record",
      schema_version: 1,
      source_occurrence_id: OCC_ID_1,
      asset_id: VALID_ASSET_ID,
      source_id: "source:camera",
      source_kind: "local_folder",
      source_location: "/media/camera",
      original_path: "DCIM/IMG_001.JPG",
      ingest_job_id: "job-1",
      observed_at: "2026-10-06T00:00:00Z",
      source_archive_id: null,
      source_archive_location: null,
      source_member: null,
    });
    const occ2 = parseSourceOccurrenceRecordV1({
      schema: "source-occurrence-record",
      schema_version: 1,
      source_occurrence_id: OCC_ID_2,
      asset_id: VALID_ASSET_ID,
      source_id: "source:backup",
      source_kind: "local_folder",
      source_location: "/media/backup",
      original_path: "Backup/IMG_001_copy.JPG",
      ingest_job_id: "job-2",
      observed_at: "2026-10-06T01:00:00Z",
    });

    const snapshot = createEmptyCatalogueSnapshot("2026-10-06T02:00:00Z");
    snapshot.canonical_assets.push({
      schema: "asset-record",
      schema_version: 1,
      asset_id: VALID_ASSET_ID,
      content_hash: VALID_ASSET_ID,
      storage_locator: "/archive/blobs/1b8f",
      mime_type: "image/jpeg",
      size_bytes: 1024,
      processing_state: "ready",
    });
    snapshot.source_occurrences.push(occ1, occ2);

    const view = buildCatalogueAssetView(VALID_ASSET_ID, snapshot);
    expect(view.asset.asset_id).toBe(VALID_ASSET_ID);
    expect(view.occurrences).toHaveLength(2);
    expect(view.occurrences.map((o) => o.source_occurrence_id)).toEqual([OCC_ID_1, OCC_ID_2]);
  });

  it("rejects orphan source occurrences when assembling a view", () => {
    const snapshot = createEmptyCatalogueSnapshot("2026-10-06T02:00:00Z");
    snapshot.canonical_assets.push({
      schema: "asset-record",
      schema_version: 1,
      asset_id: VALID_ASSET_ID,
      content_hash: VALID_ASSET_ID,
      storage_locator: "/archive/blobs/1b8f",
      mime_type: "image/jpeg",
      size_bytes: 1024,
      processing_state: "ready",
    });
    snapshot.source_occurrences.push({
      schema: "source-occurrence-record",
      schema_version: 1,
      source_occurrence_id: OCC_ID_1,
      asset_id: OTHER_ASSET_ID, // Orphan occurrence!
      source_id: "source:orphan",
      source_kind: "local_folder",
      source_location: "/media/orphan",
      original_path: "orphan.jpg",
      ingest_job_id: "job-orphan",
      observed_at: "2026-10-06T00:00:00Z",
      source_archive_id: null,
      source_archive_location: null,
      source_member: null,
    });

    expect(() => buildAllCatalogueAssetViews(snapshot)).toThrow(/orphan/i);
  });

  it("sample catalogue is empty unless explicitly enabled", () => {
    const disabled = snapshotFromFixtures(false);
    expect(disabled.canonical_assets).toHaveLength(0);
    expect(disabled.source_occurrences).toHaveLength(0);

    const enabled = snapshotFromFixtures(true);
    expect(enabled.canonical_assets.length).toBeGreaterThan(0);
    expect(enabled.source_occurrences.length).toBeGreaterThan(enabled.canonical_assets.length);
  });

  it("exact duplicate fixtures become one asset with multiple occurrences", () => {
    const snapshot = snapshotFromFixtures(true);
    const resumeId = "sha256:ce9d40e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0101";
    const matchingAssets = snapshot.canonical_assets.filter((a) => a.asset_id === resumeId);
    expect(matchingAssets).toHaveLength(1);

    const view = buildCatalogueAssetView(resumeId, snapshot);
    expect(view.occurrences).toHaveLength(2);
  });

  it("Gallery annotations do not change canonical or source records", () => {
    const snapshot = snapshotFromFixtures(true);
    const originalAsset = structuredClone(snapshot.canonical_assets[0]);
    const originalOccurrences = structuredClone(snapshot.source_occurrences);

    const updated = applyGalleryAnnotation(
      snapshot,
      originalAsset.asset_id,
      {
        reviewState: "APPROVED",
        userNotes: "Verified by user without touching canonical bytes",
      },
      "2026-10-06T03:00:00Z",
    );

    expect(updated.canonical_assets[0]).toEqual(originalAsset);
    expect(updated.source_occurrences).toEqual(originalOccurrences);
    const view = buildCatalogueAssetView(originalAsset.asset_id, updated);
    expect(view.annotations.userNotes).toBe("Verified by user without touching canonical bytes");
    expect(view.annotations.reviewState).toBe("APPROVED");
  });

  it("classifier tags are not exposed as detected objects", () => {
    const snapshot = snapshotFromFixtures(true);
    const views = buildAllCatalogueAssetViews(snapshot);
    expect(views.length).toBeGreaterThan(0);
    for (const view of views) {
      expect(view.analysis?.tags.length).toBeGreaterThan(0);
      expect(view.analysis?.tags.every((t) => t.source === "classifier")).toBe(true);
      expect(view.analysis?.detected_objects).toEqual([]);
    }
  });
});

