import { describe, expect, it } from "vitest";
import { applyGalleryAnnotation } from "../lib/catalogue/annotations";
import { createEmptyCatalogueSnapshot } from "../lib/catalogue/fixture-adapter";
import { MAX_IMPORT_BYTES, parseCanonicalImport } from "../lib/catalogue/import";
import { mergeCanonicalImport } from "../lib/catalogue/merge";
import { pickCanonicalImport } from "../lib/catalogue/pick-import";
import { buildCatalogueAssetView } from "../lib/catalogue/view-model";

const ASSET_1 = "sha256:1b8f40e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0011";
const ASSET_2 = "sha256:2f6c40e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0042";
const OCC_1 = "occurrence:sha256:1111111111111111111111111111111111111111111111111111111111111111";
const OCC_2 = "occurrence:sha256:2222222222222222222222222222222222222222222222222222222222222222";

describe("Gallery canonical import and atomic merge", () => {
  it("parses a single AssetRecordV1 and a bounded gallery-canonical-import bundle", () => {
    const single = parseCanonicalImport(
      JSON.stringify({
        schema: "asset-record",
        schema_version: 1,
        asset_id: ASSET_1,
        content_hash: ASSET_1,
        storage_locator: "/extract/blobs/1b8f",
        mime_type: "image/jpeg",
        size_bytes: 2048,
        processing_state: "ready",
      }),
    );
    expect(single.assets).toHaveLength(1);
    expect(single.assets[0].asset_id).toBe(ASSET_1);

    const bundle = parseCanonicalImport(
      JSON.stringify({
        schema: "gallery-canonical-import",
        schema_version: 1,
        assets: [
          {
            schema: "asset-record",
            schema_version: 1,
            asset_id: ASSET_1,
            content_hash: ASSET_1,
            storage_locator: "/extract/blobs/1b8f",
            mime_type: "image/jpeg",
            size_bytes: 2048,
            processing_state: "ready",
          },
        ],
        occurrences: [
          {
            schema: "source-occurrence-record",
            schema_version: 1,
            source_occurrence_id: OCC_1,
            asset_id: ASSET_1,
            source_id: "source:takeout",
            source_kind: "zip_archive",
            source_location: "/takeout/photos.zip",
            original_path: "Photos/img1.jpg",
            ingest_job_id: "job-1",
            observed_at: "2026-10-06T00:00:00Z",
          },
        ],
        metadata: [
          {
            asset_id: ASSET_1,
            title: "Imported photo",
            category: "Photos",
            previewDataUri: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          },
        ],
      }),
    );
    expect(bundle.assets).toHaveLength(1);
    expect(bundle.occurrences).toHaveLength(1);
    expect(bundle.metadata[ASSET_1]?.title).toBe("Imported photo");
  });

  it("rejects invalid JSON, oversized payloads, failed processing_state, and remote preview URLs", () => {
    expect(() => parseCanonicalImport("{not-json")).toThrow();
    expect(() => parseCanonicalImport("x".repeat(MAX_IMPORT_BYTES + 1))).toThrow(/size|limit|large/i);

    expect(() =>
      parseCanonicalImport(
        JSON.stringify({
          schema: "asset-record",
          schema_version: 1,
          asset_id: ASSET_1,
          content_hash: ASSET_1,
          storage_locator: "/extract/blobs/1b8f",
          mime_type: "image/jpeg",
          size_bytes: 2048,
          processing_state: "failed",
        }),
      ),
    ).toThrow(/ready|failed/i);

    expect(() =>
      parseCanonicalImport(
        JSON.stringify({
          schema: "gallery-canonical-import",
          schema_version: 1,
          assets: [
            {
              schema: "asset-record",
              schema_version: 1,
              asset_id: ASSET_1,
              content_hash: ASSET_1,
              storage_locator: "/extract/blobs/1b8f",
              mime_type: "image/jpeg",
              size_bytes: 2048,
              processing_state: "ready",
            },
          ],
          metadata: [
            {
              asset_id: ASSET_1,
              previewDataUri: "https://evil.example/preview.jpg",
            },
          ],
        }),
      ),
    ).toThrow(/preview|data:/i);
  });

  it("rejects duplicate asset IDs, duplicate occurrence IDs, orphan occurrences, and duplicate metadata", () => {
    const asset1Obj = {
      schema: "asset-record",
      schema_version: 1,
      asset_id: ASSET_1,
      content_hash: ASSET_1,
      storage_locator: "/extract/blobs/1b8f",
      mime_type: "image/jpeg",
      size_bytes: 2048,
      processing_state: "ready",
    };

    expect(() =>
      parseCanonicalImport(
        JSON.stringify({
          schema: "gallery-canonical-import",
          schema_version: 1,
          assets: [asset1Obj, asset1Obj],
        }),
      ),
    ).toThrow(/duplicate.*asset/i);

    const occ1Obj = {
      schema: "source-occurrence-record",
      schema_version: 1,
      source_occurrence_id: OCC_1,
      asset_id: ASSET_1,
      source_id: "source:1",
      source_kind: "local_folder",
      source_location: "/loc",
      original_path: "a.jpg",
      ingest_job_id: "job-1",
      observed_at: "2026-10-06T00:00:00Z",
    };

    expect(() =>
      parseCanonicalImport(
        JSON.stringify({
          schema: "gallery-canonical-import",
          schema_version: 1,
          assets: [asset1Obj],
          occurrences: [occ1Obj, occ1Obj],
        }),
      ),
    ).toThrow(/duplicate.*occurrence/i);

    expect(() =>
      parseCanonicalImport(
        JSON.stringify({
          schema: "gallery-canonical-import",
          schema_version: 1,
          assets: [asset1Obj],
          occurrences: [{ ...occ1Obj, asset_id: ASSET_2 }],
        }),
      ),
    ).toThrow(/orphan/i);

    expect(() =>
      parseCanonicalImport(
        JSON.stringify({
          schema: "gallery-canonical-import",
          schema_version: 1,
          assets: [asset1Obj],
          metadata: [{ asset_id: ASSET_1, title: "A" }, { asset_id: ASSET_1, title: "B" }],
        }),
      ),
    ).toThrow(/duplicate.*metadata/i);
  });

  it("merges idempotently, preserves annotations and preferred occurrence, and adds new occurrences", () => {
    const initial = createEmptyCatalogueSnapshot("2026-10-06T00:00:00Z");
    const batch1 = parseCanonicalImport(
      JSON.stringify({
        schema: "gallery-canonical-import",
        schema_version: 1,
        assets: [
          {
            schema: "asset-record",
            schema_version: 1,
            asset_id: ASSET_1,
            content_hash: ASSET_1,
            storage_locator: "/extract/blobs/1b8f",
            mime_type: "image/jpeg",
            size_bytes: 2048,
            processing_state: "ready",
          },
        ],
        occurrences: [
          {
            schema: "source-occurrence-record",
            schema_version: 1,
            source_occurrence_id: OCC_1,
            asset_id: ASSET_1,
            source_id: "source:cam",
            source_kind: "local_folder",
            source_location: "/cam",
            original_path: "DCIM/1.jpg",
            ingest_job_id: "job-1",
            observed_at: "2026-10-06T00:00:00Z",
          },
        ],
        metadata: [
          {
            asset_id: ASSET_1,
            title: "Original Title",
            previewDataUri: "data:image/png;base64,AAAA",
          },
        ],
      }),
    );

    const merged1 = mergeCanonicalImport(initial, batch1, "2026-10-06T01:00:00Z");
    const annotated = applyGalleryAnnotation(
      merged1,
      ASSET_1,
      {
        reviewState: "APPROVED",
        userNotes: "Keep this note",
        preferredSourceOccurrenceId: OCC_1,
      },
      "2026-10-06T02:00:00Z",
    );

    const batch2 = parseCanonicalImport(
      JSON.stringify({
        schema: "gallery-canonical-import",
        schema_version: 1,
        assets: [
          {
            schema: "asset-record",
            schema_version: 1,
            asset_id: ASSET_1,
            content_hash: ASSET_1,
            storage_locator: "/extract/blobs/1b8f",
            mime_type: "image/jpeg",
            size_bytes: 2048,
            processing_state: "ready",
          },
        ],
        occurrences: [
          {
            schema: "source-occurrence-record",
            schema_version: 1,
            source_occurrence_id: OCC_2,
            asset_id: ASSET_1,
            source_id: "source:backup",
            source_kind: "local_folder",
            source_location: "/backup",
            original_path: "Backup/1.jpg",
            ingest_job_id: "job-2",
            observed_at: "2026-10-06T02:30:00Z",
          },
        ],
      }),
    );

    const merged2 = mergeCanonicalImport(annotated, batch2, "2026-10-06T03:00:00Z");
    const view = buildCatalogueAssetView(ASSET_1, merged2);
    expect(view.occurrences).toHaveLength(2);
    expect(view.annotations.userNotes).toBe("Keep this note");
    expect(view.annotations.reviewState).toBe("APPROVED");
    expect(view.annotations.preferredSourceOccurrenceId).toBe(OCC_1);
    expect(view.annotations.previewDataUri).toBe("data:image/png;base64,AAAA");
  });

  it("fails atomically on canonical size/MIME conflicts or occurrence reuse without mutating input snapshot", () => {
    const initial = createEmptyCatalogueSnapshot("2026-10-06T00:00:00Z");
    const batch1 = parseCanonicalImport(
      JSON.stringify({
        schema: "gallery-canonical-import",
        schema_version: 1,
        assets: [
          {
            schema: "asset-record",
            schema_version: 1,
            asset_id: ASSET_1,
            content_hash: ASSET_1,
            storage_locator: "/extract/blobs/1b8f",
            mime_type: "image/jpeg",
            size_bytes: 2048,
            processing_state: "ready",
          },
        ],
        occurrences: [
          {
            schema: "source-occurrence-record",
            schema_version: 1,
            source_occurrence_id: OCC_1,
            asset_id: ASSET_1,
            source_id: "source:cam",
            source_kind: "local_folder",
            source_location: "/cam",
            original_path: "DCIM/1.jpg",
            ingest_job_id: "job-1",
            observed_at: "2026-10-06T00:00:00Z",
          },
        ],
      }),
    );
    const snapshot = mergeCanonicalImport(initial, batch1, "2026-10-06T01:00:00Z");
    const frozenBefore = structuredClone(snapshot);

    const conflictingSizeBatch = parseCanonicalImport(
      JSON.stringify({
        schema: "asset-record",
        schema_version: 1,
        asset_id: ASSET_1,
        content_hash: ASSET_1,
        storage_locator: "/extract/blobs/1b8f",
        mime_type: "image/jpeg",
        size_bytes: 9999,
        processing_state: "ready",
      }),
    );

    expect(() =>
      mergeCanonicalImport(snapshot, conflictingSizeBatch, "2026-10-06T02:00:00Z"),
    ).toThrow(/conflict/i);
    expect(snapshot).toEqual(frozenBefore);

    const conflictingOccurrenceBatch = parseCanonicalImport(
      JSON.stringify({
        schema: "gallery-canonical-import",
        schema_version: 1,
        assets: [
          {
            schema: "asset-record",
            schema_version: 1,
            asset_id: ASSET_2,
            content_hash: ASSET_2,
            storage_locator: "/extract/blobs/2f6c",
            mime_type: "image/png",
            size_bytes: 4096,
            processing_state: "ready",
          },
        ],
        occurrences: [
          {
            schema: "source-occurrence-record",
            schema_version: 1,
            source_occurrence_id: OCC_1, // Already bound to ASSET_1!
            asset_id: ASSET_2,
            source_id: "source:other",
            source_kind: "local_folder",
            source_location: "/other",
            original_path: "2.png",
            ingest_job_id: "job-2",
            observed_at: "2026-10-06T02:00:00Z",
          },
        ],
      }),
    );

    expect(() =>
      mergeCanonicalImport(snapshot, conflictingOccurrenceBatch, "2026-10-06T02:00:00Z"),
    ).toThrow(/occurrence.*conflict|bound/i);
    expect(snapshot).toEqual(frozenBefore);
  });

  it("handles picker cancellation, non-JSON rejection, and valid import selection", async () => {
    const cancelled = await pickCanonicalImport({
      pickDocument: async () => ({ canceled: true }),
      readText: async () => "",
    });
    expect(cancelled).toBeNull();

    await expect(
      pickCanonicalImport({
        pickDocument: async () => ({
          canceled: false,
          name: "image.jpg",
          mimeType: "image/jpeg",
          uri: "file:///tmp/image.jpg",
        }),
        readText: async () => "{}",
      }),
    ).rejects.toThrow(/json/i);

    const valid = await pickCanonicalImport({
      pickDocument: async () => ({
        canceled: false,
        name: "export.json",
        mimeType: "application/json",
        uri: "file:///tmp/export.json",
      }),
      readText: async () =>
        JSON.stringify({
          schema: "asset-record",
          schema_version: 1,
          asset_id: ASSET_1,
          content_hash: ASSET_1,
          storage_locator: "/extract/blobs/1b8f",
          mime_type: "image/jpeg",
          size_bytes: 2048,
          processing_state: "ready",
        }),
    });
    expect(valid?.assets).toHaveLength(1);
    expect(valid?.assets[0].asset_id).toBe(ASSET_1);
  });
});

