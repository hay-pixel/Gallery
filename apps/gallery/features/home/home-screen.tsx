import React from "react";
import type {
  CatalogueAssetView,
  GalleryCatalogueSnapshotV1,
} from "../../lib/catalogue/types";
import { LibraryScreen } from "../library/library-screen";
export type HomeScreenProps = {
  views: CatalogueAssetView[];
  snapshot: GalleryCatalogueSnapshotV1;
  onNavigate?: (
    tab: "Images" | "Search" | "Library" | "Sources" | "Settings",
  ) => void;
  onSelectAsset?: (view: CatalogueAssetView) => void;
};
export function HomeScreen({
  views,
  onNavigate,
  onSelectAsset,
}: HomeScreenProps) {
  return (
    <LibraryScreen
      views={views}
      onSelectAsset={onSelectAsset}
      onAddSource={() => onNavigate?.("Sources")}
    />
  );
}
