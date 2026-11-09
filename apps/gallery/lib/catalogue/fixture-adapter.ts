import CryptoJS from "crypto-js";
import { FIXTURE_FILES } from "../pixeldrive";
import { parseAssetRecordV1, parseSourceOccurrenceRecordV1 } from "./contracts";
import type {
  AnalysisView,
  AssetId,
  GalleryAnnotations,
  GalleryCatalogueSnapshotV1,
  SourceOccurrenceId,
} from "./types";

function deterministicOccurrenceHash(seed: string): SourceOccurrenceId {
  const digest = CryptoJS.SHA256(seed).toString().toLowerCase();
  return `occurrence:sha256:${digest}`;
}

export function createEmptyCatalogueSnapshot(
  now: string = new Date().toISOString(),
): GalleryCatalogueSnapshotV1 {
  return {
    schema: "gallery-catalogue-cache",
    schema_version: 1,
    saved_at: now,
    canonical_assets: [],
    source_occurrences: [],
    analysis_views: [],
    annotations: {},
    discovered_sources: [],
    capability_state: {
      analysis: "unavailable",
      search: "unavailable",
      ollama: "unavailable",
    },
  };
}

export function snapshotFromFixtures(
  enabled: boolean,
  now: string = "2026-10-06T00:00:00Z",
): GalleryCatalogueSnapshotV1 {
  const snapshot = createEmptyCatalogueSnapshot(now);
  if (!enabled) {
    return snapshot;
  }

  for (const file of FIXTURE_FILES) {
    const assetRecord = parseAssetRecordV1({
      schema: "asset-record",
      schema_version: 1,
      asset_id: file.assetId,
      content_hash: file.assetId,
      storage_locator: `fixture://blobs/${file.assetId.slice("sha256:".length)}`,
      mime_type: file.mimeType,
      size_bytes: file.sizeBytes,
      processing_state: "ready",
    });
    snapshot.canonical_assets.push(assetRecord);

    const mappedOccurrences = file.sources.map((source, index) => {
      const occurrenceId = deterministicOccurrenceHash(
        `${file.assetId}:${source.sourceOccurrenceId}:${source.originalPath}:${index}`,
      );
      return parseSourceOccurrenceRecordV1({
        schema: "source-occurrence-record",
        schema_version: 1,
        source_occurrence_id: occurrenceId,
        asset_id: file.assetId,
        source_id: source.sourceId,
        source_kind: source.sourceKind,
        source_location: source.sourceLocation,
        original_path: source.originalPath,
        ingest_job_id: "fixture-ingest-v1",
        observed_at: `${file.dateTaken}T00:00:00Z`,
        source_archive_id: source.archiveId ?? null,
        source_archive_location: source.archiveLocation ?? null,
        source_member: source.sourceMember ?? null,
      });
    });

    snapshot.source_occurrences.push(...mappedOccurrences);

    const analysisView: AnalysisView = {
      asset_id: file.assetId,
      analysis_id: `analysis:${file.assetId}`,
      result_id: `result:${file.assetId}`,
      status:
        file.analysisState === "available"
          ? "ready"
          : file.analysisState === "pending"
            ? "pending"
            : file.analysisState === "unsupported"
              ? "unsupported"
              : "failed",
      tags: file.tags.map((tag) => ({
        tag,
        confidence: file.confidence,
        source: "classifier",
      })),
      detected_objects: [],
      ocr_text: file.ocrText,
      visual_description: file.visualDescription,
      updated_at: now,
    };
    snapshot.analysis_views.push(analysisView);

    const annotations: GalleryAnnotations = {
      asset_id: file.assetId as AssetId,
      title: file.fileName,
      kind: file.kind,
      category: file.category,
      subcategory: file.subcategory,
      dateTaken: file.dateTaken,
      dateSource: file.dateSource,
      reviewState: file.reviewState,
      reviewEvidence: file.reviewEvidence,
      confidence: file.confidence,
      duplicateGroupId: file.duplicateGroupId,
      isPreferredCopy: file.isPreferredCopy,
      preferredSourceOccurrenceId: mappedOccurrences[0]?.source_occurrence_id,
      isTechnicalSidecar: file.isTechnicalSidecar,
      isFlagged18Plus: file.isFlagged18Plus,
      userNotes: file.userNotes,
      labels: [...file.tags],
      previewColor: file.previewColor,
      updated_at: now,
    };
    snapshot.annotations[file.assetId] = annotations;
  }

  snapshot.capability_state.analysis = "ready";
  return snapshot;
}
