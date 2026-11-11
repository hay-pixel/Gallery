import React from "react";
import { Image, StyleSheet } from "react-native";
import type { CatalogueAssetView } from "../../lib/catalogue/types";
import { MAX_PREVIEW_DATA_URI_BYTES } from "../../lib/catalogue/import";

export function AssetPreview({ view }: { view: CatalogueAssetView }) {
  const uri = view.annotations.previewDataUri;
  // Imported storage locators are provenance, never media URLs to dereference.
  if (
    !uri ||
    uri.length > MAX_PREVIEW_DATA_URI_BYTES ||
    !/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(uri)
  )
    return null;
  return (
    <Image
      source={{ uri }}
      accessibilityLabel={view.displayName}
      resizeMode="cover"
      style={StyleSheet.absoluteFillObject}
    />
  );
}
