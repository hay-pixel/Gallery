import { createEmptyCatalogueSnapshot } from "./fixture-adapter";
import type { GalleryCatalogueSnapshotV1 } from "./types";
export function initialLibrary(cached: GalleryCatalogueSnapshotV1 | null) {
  return cached ?? createEmptyCatalogueSnapshot();
}
export function hasDemoAssets(snapshot: GalleryCatalogueSnapshotV1) {
  return snapshot.canonical_assets.some((asset) =>
    asset.storage_locator.startsWith("fixture://"),
  );
}
export function removeDemoAssets(
  snapshot: GalleryCatalogueSnapshotV1,
): GalleryCatalogueSnapshotV1 {
  const ids = new Set(
    snapshot.canonical_assets
      .filter((asset) => asset.storage_locator.startsWith("fixture://"))
      .map((asset) => asset.asset_id),
  );
  return {
    ...snapshot,
    saved_at: new Date().toISOString(),
    canonical_assets: snapshot.canonical_assets.filter(
      (asset) => !ids.has(asset.asset_id),
    ),
    source_occurrences: snapshot.source_occurrences.filter(
      (occurrence) => !ids.has(occurrence.asset_id),
    ),
    analysis_views: snapshot.analysis_views.filter(
      (analysis) => !ids.has(analysis.asset_id),
    ),
    annotations: Object.fromEntries(
      Object.entries(snapshot.annotations).filter(([id]) => !ids.has(id)),
    ),
    discovered_sources: snapshot.discovered_sources.filter(
      (source) => !source.linkedAssetId || !ids.has(source.linkedAssetId),
    ),
  };
}
