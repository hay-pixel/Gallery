import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { CatalogueAssetView } from "../../lib/catalogue/types";

export type ImagesScreenProps = {
  views: CatalogueAssetView[];
  onSelectAsset?: (view: CatalogueAssetView) => void;
};

export function ImagesScreen({ views, onSelectAsset }: ImagesScreenProps) {
  const [filter, setFilter] = useState<string>("All");

  const images = useMemo(() => {
    return views.filter((view) => {
      const isImg = view.asset.mime_type.startsWith("image/");
      if (!isImg) return false;
      if (filter === "All") return true;
      if (filter === "Photos") return view.annotations.kind === "Photo";
      if (filter === "Memes") return view.annotations.kind === "Meme";
      if (filter === "Screenshots") {
        return view.occurrences.some((occ) =>
          occ.original_path.toLowerCase().includes("screenshot"),
        );
      }
      return true;
    });
  }, [views, filter]);

  const categories = ["All", "Photos", "Screenshots", "Memes"];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Images</Text>
          <Text style={styles.subtitle}>Canonical visuals without changing source files</Text>
        </View>
        <View style={styles.iconCircle}>
          <MaterialIcons name="image" size={20} color="#50D4FF" />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {categories.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setFilter(cat)}
            style={[styles.filterChip, filter === cat && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === cat && styles.filterTextActive]}>
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.grid}>
        {images.length > 0 ? (
          <View style={styles.tileWrap}>
            {images.map((item) => (
              <Pressable
                key={item.asset.asset_id}
                onPress={() => onSelectAsset?.(item)}
                style={styles.imageTile}
              >
                <View
                  style={[
                    styles.visual,
                    { backgroundColor: item.annotations.previewColor ?? "#2F80ED" },
                  ]}
                >
                  <MaterialIcons name="image" size={32} color="#FFFFFF" />
                </View>
                <View style={styles.tileInfo}>
                  <Text style={styles.tileName} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text style={styles.tileMeta}>{item.annotations.category ?? "Photos"}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.empty}>
            <MaterialIcons name="image-not-supported" size={32} color="#A8B4C8" />
            <Text style={styles.emptyTitle}>No images match this filter</Text>
            <Text style={styles.emptySub}>Connect a source to discover more media.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
    backgroundColor: "#080D18",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#F4F7FB",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: "#A8B4C8",
    fontSize: 12,
    marginTop: 2,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#50D4FF17",
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 14,
  },
  filterChip: {
    backgroundColor: "#11192C",
    borderColor: "#263554",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: "#2F80ED",
    borderColor: "#2F80ED",
  },
  filterText: {
    color: "#A8B4C8",
    fontSize: 11,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  grid: {
    paddingBottom: 24,
  },
  tileWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  imageTile: {
    width: "48%",
    backgroundColor: "#11192C",
    borderColor: "#263554",
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
    padding: 8,
  },
  visual: {
    width: "100%",
    height: 120,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tileInfo: {
    marginTop: 6,
    gap: 2,
  },
  tileName: {
    color: "#F4F7FB",
    fontSize: 11,
    fontWeight: "700",
  },
  tileMeta: {
    color: "#A8B4C8",
    fontSize: 10,
  },
  empty: {
    paddingTop: 64,
    alignItems: "center",
    gap: 8,
  },
  emptyTitle: {
    color: "#F4F7FB",
    fontSize: 14,
    fontWeight: "700",
  },
  emptySub: {
    color: "#A8B4C8",
    fontSize: 12,
  },
});

