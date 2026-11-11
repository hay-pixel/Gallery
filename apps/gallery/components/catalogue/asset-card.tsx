import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CatalogueAssetView } from "../../lib/catalogue/types";
import { AssetPreview } from "./asset-preview";
import { formatBytes } from "../../lib/pixeldrive";

export type AssetCardProps = {
  view: CatalogueAssetView;
  onPress?: () => void;
};

export function AssetCard({ view, onPress }: AssetCardProps) {
  const isImage = view.asset.mime_type.startsWith("image/");
  const isVideo = view.asset.mime_type.startsWith("video/");
  const iconName: keyof typeof MaterialIcons.glyphMap = isImage
    ? "photo"
    : isVideo
      ? "videocam"
      : "description";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.thumbnail,
          { backgroundColor: view.annotations.previewColor ?? "#2F80ED" },
        ]}
      >
        <MaterialIcons name={iconName} size={24} color="#FFFFFF" />
        <AssetPreview view={view} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {view.displayName}
        </Text>
        <Text style={styles.meta}>
          {view.annotations.category ?? "Archive"} ·{" "}
          {formatBytes(view.asset.size_bytes)}
        </Text>
        {view.occurrences.length > 1 ? (
          <Text style={styles.occurrences}>
            {view.occurrences.length} source occurrences
          </Text>
        ) : null}
      </View>
      {view.annotations.reviewState === "NEEDS_REVIEW" ? (
        <MaterialIcons name="pending-actions" size={18} color="#F6C75B" />
      ) : (
        <MaterialIcons name="chevron-right" size={18} color="#A8B4C8" />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#11192C",
    borderColor: "#263554",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginVertical: 4,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },
  thumbnail: {
    overflow: "hidden",
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: "#F4F7FB",
    fontSize: 13,
    fontWeight: "700",
  },
  meta: {
    color: "#A8B4C8",
    fontSize: 11,
  },
  occurrences: {
    color: "#50D4FF",
    fontSize: 10,
    fontWeight: "600",
  },
});
