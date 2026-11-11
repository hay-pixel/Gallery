import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AssetCard } from "../../components/catalogue/asset-card";
import { browseCatalogue } from "../../lib/catalogue/browse";
import type { CatalogueAssetView } from "../../lib/catalogue/types";

export type LibraryScreenProps = {
  views: CatalogueAssetView[];
  onSelectAsset?: (view: CatalogueAssetView) => void;
  onNavigateReviews?: () => void;
  onNavigateDuplicates?: () => void;
};

export function LibraryScreen({
  views,
  onSelectAsset,
  onNavigateReviews,
  onNavigateDuplicates,
}: LibraryScreenProps) {
  const [filter, setFilter] = useState("All");

  const categories = [
    "All",
    "Photos",
    "Videos",
    "Documents",
    "Writing",
    "Life Admin",
    "Needs Review",
    "Duplicates",
  ];

  const pendingCount = views.filter(
    (v) => v.annotations.reviewState === "NEEDS_REVIEW",
  ).length;
  const duplicateCount = views.filter((v) => v.occurrences.length > 1).length;

  const filteredViews = useMemo(() => {
    if (filter === "Needs Review") {
      return views.filter((v) => v.annotations.reviewState === "NEEDS_REVIEW");
    }
    if (filter === "Duplicates") {
      return views.filter((v) => v.occurrences.length > 1);
    }
    return browseCatalogue(views, "", {
      category: filter === "All" ? undefined : filter,
    });
  }, [views, filter]);

  const handleReviewsClick = () => {
    if (onNavigateReviews) {
      onNavigateReviews();
    } else {
      setFilter("Needs Review");
    }
  };

  const handleDuplicatesClick = () => {
    if (onNavigateDuplicates) {
      onNavigateDuplicates();
    } else {
      setFilter("Duplicates");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Library</Text>
          <Text style={styles.subtitle}>
            Every asset in your canonical catalogue
          </Text>
        </View>
        <View style={styles.iconCircle}>
          <MaterialIcons name="folder" size={20} color="#50D4FF" />
        </View>
      </View>

      <View style={styles.subLinks}>
        <Pressable onPress={handleReviewsClick} style={styles.subLinkCard}>
          <MaterialIcons name="pending-actions" size={16} color="#F6C75B" />
          <Text style={styles.subLinkText}>
            Reviews {pendingCount > 0 ? `(${pendingCount})` : ""}
          </Text>
          <MaterialIcons name="chevron-right" size={16} color="#A8B4C8" />
        </Pressable>
        <Pressable onPress={handleDuplicatesClick} style={styles.subLinkCard}>
          <MaterialIcons name="content-copy" size={16} color="#9A7DFF" />
          <Text style={styles.subLinkText}>
            Duplicates {duplicateCount > 0 ? `(${duplicateCount})` : ""}
          </Text>
          <MaterialIcons name="chevron-right" size={16} color="#A8B4C8" />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        style={styles.filterStrip}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {categories.map((cat) => (
          <Pressable
            key={cat}
            onPress={() => setFilter(cat)}
            style={[
              styles.filterChip,
              filter === cat && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                filter === cat && styles.filterTextActive,
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={filteredViews}
        keyExtractor={(item) => item.asset.asset_id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <AssetCard view={item} onPress={() => onSelectAsset?.(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="folder-open" size={32} color="#A8B4C8" />
            <Text style={styles.emptyTitle}>No files in this category</Text>
            <Text style={styles.emptySub}>
              Select &apos;All&apos; to view your full library.
            </Text>
          </View>
        }
      />
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
  subLinks: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  subLinkCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#11192C",
    borderColor: "#263554",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  subLinkText: {
    color: "#F4F7FB",
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  filterStrip: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingVertical: 12,
  },
  filterChip: {
    minHeight: 44,
    justifyContent: "center",
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
  list: {
    paddingBottom: 24,
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
