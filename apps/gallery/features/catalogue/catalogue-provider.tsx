import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyGalleryAnnotation,
  type GalleryAnnotationPatch,
} from "../../lib/catalogue/annotations";
import { galleryDeviceCache } from "../../lib/catalogue/device-cache";
import { initialLibrary, removeDemoAssets } from "../../lib/catalogue/demo";
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
  annotateAsset: (
    assetId: string,
    patch: GalleryAnnotationPatch,
  ) => Promise<void>;
  reloadFromCache: () => Promise<void>;
  loadDemo: () => Promise<void>;
  exitDemo: () => Promise<void>;
};
const CatalogueContext = createContext<CatalogueContextValue | null>(null);
export function CatalogueProvider({
  children,
  initialSnapshot,
}: {
  children: React.ReactNode;
  initialSnapshot?: GalleryCatalogueSnapshotV1;
}) {
  const [snapshot, setSnapshot] = useState(
    initialSnapshot ?? createEmptyCatalogueSnapshot(),
  );
  const latest = useRef(snapshot);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [loading, setLoading] = useState(!initialSnapshot);
  const [error, setError] = useState<string | null>(null);
  const mutate = useCallback(
    (
      transform: (
        current: GalleryCatalogueSnapshotV1,
      ) => GalleryCatalogueSnapshotV1,
    ) => {
      const operation = queue.current.then(async () => {
        setError(null);
        const next = transform(latest.current);
        await galleryDeviceCache.write(next);
        latest.current = next;
        setSnapshot(next);
      });
      queue.current = operation.catch(() => undefined);
      return operation.catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Could not save your library.",
        );
        throw err;
      });
    },
    [],
  );
  const reloadFromCache = useCallback(async () => {
    setLoading(true);
    try {
      await queue.current;
      const next = initialLibrary(await galleryDeviceCache.read());
      latest.current = next;
      setSnapshot(next);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load your library.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!initialSnapshot) void reloadFromCache();
  }, [initialSnapshot, reloadFromCache]);
  const importCanonicalBatch = useCallback(
    (batch: CanonicalImportBatch) =>
      mutate((current) => mergeCanonicalImport(current, batch)),
    [mutate],
  );
  const annotateAsset = useCallback(
    (assetId: string, patch: GalleryAnnotationPatch) =>
      mutate((current) => applyGalleryAnnotation(current, assetId, patch)),
    [mutate],
  );
  const loadDemo = useCallback(
    () =>
      mutate((current) =>
        current.canonical_assets.length ? current : snapshotFromFixtures(true),
      ),
    [mutate],
  );
  const exitDemo = useCallback(() => mutate(removeDemoAssets), [mutate]);
  const derived = useMemo(() => {
    try {
      return { views: buildAllCatalogueAssetViews(snapshot), error: null };
    } catch {
      return {
        views: [],
        error:
          "Some saved records could not be read. Your saved data has been kept.",
      };
    }
  }, [snapshot]);
  return (
    <CatalogueContext.Provider
      value={{
        snapshot,
        views: derived.views,
        loading,
        error: error ?? derived.error,
        importCanonicalBatch,
        annotateAsset,
        reloadFromCache,
        loadDemo,
        exitDemo,
      }}
    >
      {children}
    </CatalogueContext.Provider>
  );
}
export function useCatalogue() {
  const value = useContext(CatalogueContext);
  if (!value)
    throw new Error("useCatalogue must be used within a CatalogueProvider");
  return value;
}
