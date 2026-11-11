import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { galleryTheme as t } from "../../constants/gallery-theme";
import type { CatalogueAssetView } from "../../lib/catalogue/types";
import { formatBytes } from "../../lib/pixeldrive";
import { AssetPreview } from "./asset-preview";

export function AssetCard({
  view,
  onPress,
  layout = "list",
}: {
  view: CatalogueAssetView;
  onPress?: () => void;
  layout?: "list" | "grid";
}) {
  const image = view.asset.mime_type.startsWith("image/");
  const video = view.asset.mime_type.startsWith("video/");
  const icon = image ? "image" : video ? "play-circle-outline" : "description";
  const grid = layout === "grid";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${view.displayName}`}
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        grid && s.gridCard,
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={grid ? s.gridVisual : s.visual}>
        <View style={s.placeholder}>
          <MaterialIcons name={icon} size={grid ? 32 : 24} color={t.muted} />
          {grid ? (
            <Text style={s.noPreview}>
              {image ? "Image" : video ? "Video" : "Document"}
            </Text>
          ) : null}
        </View>
        <AssetPreview view={view} />
        {view.annotations.reviewState === "NEEDS_REVIEW" ? (
          <View style={s.reviewDot} accessibilityLabel="Needs review" />
        ) : null}
      </View>
      <View style={[s.info, grid && s.gridInfo]}>
        <Text style={s.name} numberOfLines={1}>
          {view.displayName}
        </Text>
        <Text style={s.meta} numberOfLines={1}>
          {formatBytes(view.asset.size_bytes)}
          {view.occurrences.length > 1
            ? ` · ${view.occurrences.length} copies`
            : ""}
        </Text>
      </View>
      {!grid ? (
        <MaterialIcons name="chevron-right" size={20} color={t.muted} />
      ) : null}
    </Pressable>
  );
}
const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: t.border,
    minHeight: 84,
  },
  gridCard: {
    flexDirection: "column",
    alignItems: "stretch",
    paddingVertical: 0,
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: t.surface,
    gap: 0,
  },
  visual: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: t.raised,
  },
  gridVisual: {
    width: "100%",
    aspectRatio: 1.16,
    overflow: "hidden",
    backgroundColor: t.raised,
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  noPreview: { color: t.muted, fontSize: 12 },
  info: { flex: 1, minWidth: 0, gap: 5 },
  gridInfo: { padding: 12, flex: undefined, minHeight: 65 },
  name: { color: t.text, fontSize: 14, fontWeight: "500" },
  meta: { color: t.muted, fontSize: 12, lineHeight: 18 },
  reviewDot: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: t.warning,
    borderColor: t.surface,
    borderWidth: 2,
  },
});
