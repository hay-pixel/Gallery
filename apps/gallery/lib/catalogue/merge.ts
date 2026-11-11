import { cloneCatalogueValue } from "./clone";
import {
  parseAssetRecordV1,
  parseSourceOccurrenceRecordV1,
  type AssetRecordV1,
  type SourceOccurrenceRecordV1,
} from "./contracts";
import type { CanonicalImportBatch } from "./import";
import type {
  AssetId,
  GalleryAnnotations,
  GalleryCatalogueSnapshotV1,
  SourceOccurrenceId,
} from "./types";
import { validateSnapshotIntegrity } from "./view-model";

function assetsMatchCanonically(a: AssetRecordV1, b: AssetRecordV1): boolean {
  return (
    a.asset_id === b.asset_id &&
    a.content_hash === b.content_hash &&
    a.mime_type === b.mime_type &&
    a.size_bytes === b.size_bytes &&
    a.processing_state === b.processing_state
  );
}

function occurrencesMatchCanonically(
  a: SourceOccurrenceRecordV1,
  b: SourceOccurrenceRecordV1,
): boolean {
  return (
    a.source_occurrence_id === b.source_occurrence_id &&
    a.asset_id === b.asset_id &&
    a.source_id === b.source_id &&
    a.source_kind === b.source_kind &&
    a.source_location === b.source_location &&
    a.original_path === b.original_path
  );
}

export function mergeCanonicalImport(
  snapshot: GalleryCatalogueSnapshotV1,
  batch: CanonicalImportBatch,
  now: string = new Date().toISOString(),
): GalleryCatalogueSnapshotV1 {
  validateSnapshotIntegrity(snapshot);

  const assetMap = new Map<AssetId, AssetRecordV1>();
  for (const existing of snapshot.canonical_assets) {
    assetMap.set(existing.asset_id, cloneCatalogueValue(existing));
  }

  for (const incomingRaw of batch.assets) {
    const incoming = parseAssetRecordV1(incomingRaw);
    if (incoming.processing_state !== "ready") {
      throw new Error(
        `Cannot merge non-ready canonical asset ${incoming.asset_id}`,
      );
    }
    const current = assetMap.get(incoming.asset_id);
    if (current) {
      if (!assetsMatchCanonically(current, incoming)) {
        throw new Error(
          `Canonical asset conflict for ${incoming.asset_id}: incoming size/MIME/hash differs from existing record`,
        );
      }
    } else {
      assetMap.set(incoming.asset_id, cloneCatalogueValue(incoming));
    }
  }

  const occurrenceMap = new Map<SourceOccurrenceId, SourceOccurrenceRecordV1>();
  for (const existingOcc of snapshot.source_occurrences) {
    occurrenceMap.set(
      existingOcc.source_occurrence_id,
      cloneCatalogueValue(existingOcc),
    );
  }

  for (const incomingOccRaw of batch.occurrences) {
    const incomingOcc = parseSourceOccurrenceRecordV1(incomingOccRaw);
    if (!assetMap.has(incomingOcc.asset_id)) {
      throw new Error(
        `Orphan occurrence ${incomingOcc.source_occurrence_id} references unknown asset_id ${incomingOcc.asset_id}`,
      );
    }
    const existingOcc = occurrenceMap.get(incomingOcc.source_occurrence_id);
    if (existingOcc) {
      if (!occurrencesMatchCanonically(existingOcc, incomingOcc)) {
        throw new Error(
          `Source occurrence conflict for ${incomingOcc.source_occurrence_id}: already bound with different provenance`,
        );
      }
    } else {
      occurrenceMap.set(
        incomingOcc.source_occurrence_id,
        cloneCatalogueValue(incomingOcc),
      );
    }
  }

  const nextAnnotations: Record<AssetId, GalleryAnnotations> =
    cloneCatalogueValue(snapshot.annotations);

  for (const asset of batch.assets) {
    const meta = batch.metadata[asset.asset_id];
    const prior = nextAnnotations[asset.asset_id];

    if (prior) {
      nextAnnotations[asset.asset_id] = {
        ...prior,
        title: prior.title ?? meta?.title,
        category: prior.category ?? meta?.category,
        subcategory: prior.subcategory ?? meta?.subcategory,
        dateTaken: prior.dateTaken ?? meta?.dateTaken,
        dateSource: prior.dateSource ?? meta?.dateSource,
        previewColor: prior.previewColor ?? meta?.previewColor,
        previewDataUri: meta?.previewDataUri ?? prior.previewDataUri,
        labels:
          prior.labels.length > 0
            ? [...prior.labels]
            : meta?.labels
              ? [...meta.labels]
              : [],
      };
    } else if (meta) {
      nextAnnotations[asset.asset_id] = {
        asset_id: asset.asset_id,
        title: meta.title,
        category: meta.category,
        subcategory: meta.subcategory,
        dateTaken: meta.dateTaken,
        dateSource: meta.dateSource,
        reviewState: "NEEDS_REVIEW",
        userNotes: "",
        labels: meta.labels ? [...meta.labels] : [],
        previewColor: meta.previewColor,
        previewDataUri: meta.previewDataUri,
        updated_at: now,
      };
    }
  }

  const nextSnapshot: GalleryCatalogueSnapshotV1 = {
    schema: "gallery-catalogue-cache",
    schema_version: 1,
    saved_at: now,
    canonical_assets: [...assetMap.values()].sort((a, b) =>
      a.asset_id.localeCompare(b.asset_id),
    ),
    source_occurrences: [...occurrenceMap.values()].sort((a, b) =>
      a.source_occurrence_id.localeCompare(b.source_occurrence_id),
    ),
    analysis_views: cloneCatalogueValue(snapshot.analysis_views),
    annotations: nextAnnotations,
    discovered_sources: cloneCatalogueValue(snapshot.discovered_sources),
    capability_state: cloneCatalogueValue(snapshot.capability_state),
  };

  validateSnapshotIntegrity(nextSnapshot);
  return nextSnapshot;
}
