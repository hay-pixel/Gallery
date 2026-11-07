import type { AssetId, GalleryAnnotations, GalleryCatalogueSnapshotV1 } from "./types";

export type GalleryAnnotationPatch = Partial<
  Omit<GalleryAnnotations, "asset_id" | "updated_at">
>;

export function applyGalleryAnnotation(
  snapshot: GalleryCatalogueSnapshotV1,
  assetId: AssetId,
  patch: GalleryAnnotationPatch,
  now: string = new Date().toISOString(),
): GalleryCatalogueSnapshotV1 {
  const exists = snapshot.canonical_assets.some((asset) => asset.asset_id === assetId);
  if (!exists) {
    throw new Error(`Cannot annotate unknown canonical asset: ${assetId}`);
  }

  const existing = snapshot.annotations[assetId] ?? {
    asset_id: assetId,
    reviewState: "NEEDS_REVIEW",
    userNotes: "",
    labels: [],
    updated_at: now,
  };

  if (patch.preferredSourceOccurrenceId !== undefined) {
    const validOccurrence = snapshot.source_occurrences.some(
      (occ) =>
        occ.asset_id === assetId &&
        occ.source_occurrence_id === patch.preferredSourceOccurrenceId,
    );
    if (!validOccurrence) {
      throw new Error(
        `Preferred source occurrence ${patch.preferredSourceOccurrenceId} does not belong to ${assetId}`,
      );
    }
  }

  const nextAnnotation: GalleryAnnotations = {
    ...structuredClone(existing),
    ...structuredClone(patch),
    asset_id: assetId,
    updated_at: now,
  };

  return {
    ...snapshot,
    saved_at: now,
    canonical_assets: structuredClone(snapshot.canonical_assets),
    source_occurrences: structuredClone(snapshot.source_occurrences),
    analysis_views: structuredClone(snapshot.analysis_views),
    discovered_sources: structuredClone(snapshot.discovered_sources),
    capability_state: structuredClone(snapshot.capability_state),
    annotations: {
      ...structuredClone(snapshot.annotations),
      [assetId]: nextAnnotation,
    },
  };
}

