import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { applyGalleryAnnotation, type GalleryAnnotationPatch } from "../../lib/catalogue/annotations";
import { galleryDeviceCache } from "../../lib/catalogue/device-cache";
import {
  createEmptyCatalogueSnapshot,
  snapshotFromFixtures,
} from "../../lib/catalogue/fixture-adapter";
import type { CanonicalImportBatch } from "../../lib/catalogue/import";
import { mergeCanonicalImport } from "../../lib/catalogue/merge";
import type {
  CatalogueAssetView,
  GalleryCatalogueSnapshotV1,
} from "../../lib/catalogue/types";
import { buildAllCatalogueAssetViews } from "../../lib/catalogue/view-model";

export type CatalogueContextValue = {
  snapshot: GalleryCatalogueSnapshotV1;
  views: CatalogueAssetView[];
  loading: boolean;
  error: string | null;
  importCanonicalBatch: (batch: CanonicalImportBatch) => Promise<void>;
  annotateAsset: (assetId: string, patch: GalleryAnnotationPatch) => Promise<void>;
  reloadFromCache: () => Promise<void>;
};

const CatalogueContext = createContext<CatalogueContextValue | null>(null);

export function CatalogueProvider({
  children,
  initialSnapshot,
}: {
  children: React.ReactNode;
  initialSnapshot?: GalleryCatalogueSnapshotV1;
}) {
  const [snapshot, setSnapshot] = useState<GalleryCatalogueSnapshotV1>(
    initialSnapshot ?? createEmptyCatalogueSnapshot(),
  );
  const [loading, setLoading] = useState<boolean>(!initialSnapshot);
  const [error, setError] = useState<string | null>(null);

  const reloadFromCache = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const cached = await galleryDeviceCache.read();
      if (cached) {
        setSnapshot(cached);
      } else {
        // Fall back to sample fixtures if cache is uninitialized
        const sample = snapshotFromFixtures(true);
        setSnapshot(sample);
        await galleryDeviceCache.write(sample);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialSnapshot) {
      void reloadFromCache();
    }
  }, [initialSnapshot, reloadFromCache]);

  const importCanonicalBatch = useCallback(
    async (batch: CanonicalImportBatch) => {
      try {
        setError(null);
        const merged = mergeCanonicalImport(snapshot, batch);
        await galleryDeviceCache.write(merged);
        setSnapshot(merged);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      }
    },
    [snapshot],
  );

  const annotateAsset = useCallback(
    async (assetId: string, patch: GalleryAnnotationPatch) => {
      try {
        setError(null);
        const updated = applyGalleryAnnotation(snapshot, assetId, patch);
        await galleryDeviceCache.write(updated);
        setSnapshot(updated);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      }
    },
    [snapshot],
  );

  const views = useMemo(() => {
    try {
      return buildAllCatalogueAssetViews(snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return [];
    }
  }, [snapshot]);

  const value = useMemo<CatalogueContextValue>(
    () => ({
      snapshot,
      views,
      loading,
      error,
      importCanonicalBatch,
      annotateAsset,
      reloadFromCache,
    }),
    [snapshot, views, loading, error, importCanonicalBatch, annotateAsset, reloadFromCache],
  );

  return (
    <CatalogueContext.Provider value={value}>
      {children}
    </CatalogueContext.Provider>
  );
}

export function useCatalogue(): CatalogueContextValue {
  const ctx = useContext(CatalogueContext);
  if (!ctx) {
    throw new Error("useCatalogue must be used within a CatalogueProvider");
  }
  return ctx;
}

