import { parseAssetRecordV1, parseSourceOccurrenceRecordV1 } from "./contracts";
import type {
  AnalysisView,
  AssetId,
  CatalogueAssetView,
  GalleryAnnotations,
  GalleryCatalogueSnapshotV1,
} from "./types";

function defaultAnnotations(assetId: AssetId, savedAt: string): GalleryAnnotations {
  return {
    asset_id: assetId,
    reviewState: "NEEDS_REVIEW",
    userNotes: "",
    labels: [],
    updated_at: savedAt,
  };
}

function basenameFromPath(pathValue: string): string {
  const normalized = pathValue.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? pathValue;
}

export function validateSnapshotIntegrity(snapshot: GalleryCatalogueSnapshotV1): void {
  const assetIds = new Set<AssetId>();
  for (const rawAsset of snapshot.canonical_assets) {
    const asset = parseAssetRecordV1(rawAsset);
    assetIds.add(asset.asset_id);
  }

  for (const rawOcc of snapshot.source_occurrences) {
    const occ = parseSourceOccurrenceRecordV1(rawOcc);
    if (!assetIds.has(occ.asset_id)) {
      throw new Error(
        `Orphan source_occurrence_id ${occ.source_occurrence_id} references missing asset_id ${occ.asset_id}`,
      );
    }
  }

  for (const [annotatedId, annotation] of Object.entries(snapshot.annotations)) {
    if (!assetIds.has(annotatedId) || annotation.asset_id !== annotatedId) {
      throw new Error(`Orphan or mismatched annotation for asset_id ${annotatedId}`);
    }
  }

  for (const analysis of snapshot.analysis_views) {
    if (!assetIds.has(analysis.asset_id)) {
      throw new Error(`Orphan analysis_view for asset_id ${analysis.asset_id}`);
    }
  }
}

export function buildCatalogueAssetView(
  assetId: AssetId,
  snapshot: GalleryCatalogueSnapshotV1,
): CatalogueAssetView {
  validateSnapshotIntegrity(snapshot);

  const assetRecord = snapshot.canonical_assets.find((item) => item.asset_id === assetId);
  if (!assetRecord) {
    throw new Error(`Canonical asset not found: ${assetId}`);
  }

  const asset = structuredClone(parseAssetRecordV1(assetRecord));
  const occurrences = snapshot.source_occurrences
    .filter((occ) => occ.asset_id === assetId)
    .map((occ) => structuredClone(parseSourceOccurrenceRecordV1(occ)));

  const rawAnalysis = snapshot.analysis_views.find((item) => item.asset_id === assetId) ?? null;
  const analysis: AnalysisView | null = rawAnalysis
    ? {
        ...structuredClone(rawAnalysis),
        tags: rawAnalysis.tags.map((t) => ({ ...t, source: "classifier" as const })),
        detected_objects: rawAnalysis.detected_objects
          .filter((obj) => obj.source === "detector")
          .map((obj) => ({ ...structuredClone(obj), source: "detector" as const })),
      }
    : null;

  const rawAnnotations = snapshot.annotations[assetId];
  const annotations: GalleryAnnotations = rawAnnotations
    ? structuredClone(rawAnnotations)
    : defaultAnnotations(assetId, snapshot.saved_at);

  const preferredOccurrence =
    (annotations.preferredSourceOccurrenceId
      ? occurrences.find(
          (occ) => occ.source_occurrence_id === annotations.preferredSourceOccurrenceId,
        )
      : undefined) ??
    occurrences[0] ??
    null;

  const displayName =
    annotations.title ??
    (preferredOccurrence ? basenameFromPath(preferredOccurrence.original_path) : asset.asset_id);

  return {
    asset,
    occurrences,
    analysis,
    annotations,
    displayName,
    primaryOccurrence: preferredOccurrence ? structuredClone(preferredOccurrence) : null,
  };
}

export function buildAllCatalogueAssetViews(
  snapshot: GalleryCatalogueSnapshotV1,
): CatalogueAssetView[] {
  validateSnapshotIntegrity(snapshot);
  return snapshot.canonical_assets.map((asset) =>
    buildCatalogueAssetView(asset.asset_id, snapshot),
  );
}

