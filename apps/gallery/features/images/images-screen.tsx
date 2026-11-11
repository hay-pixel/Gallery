import React from "react";
import type { CatalogueAssetView } from "../../lib/catalogue/types";
import { LibraryScreen } from "../library/library-screen";
export type ImagesScreenProps = {
  views: CatalogueAssetView[];
  onSelectAsset?: (view: CatalogueAssetView) => void;
};
export function ImagesScreen(props: ImagesScreenProps) {
  return <LibraryScreen {...props} initialFilter="Images" title="Images" />;
}
