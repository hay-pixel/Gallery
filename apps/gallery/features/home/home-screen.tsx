import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CapabilityBanner } from "../../components/capability-banner";
import { AssetCard } from "../../components/catalogue/asset-card";
import type {
  CatalogueAssetView,
  GalleryCatalogueSnapshotV1,
} from "../../lib/catalogue/types";

export type HomeScreenProps = {
  views: CatalogueAssetView[];
  snapshot: GalleryCatalogueSnapshotV1;
  onNavigate?: (tab: "Images" | "Search" | "Library" | "Sources" | "Settings") => void;
  onSelectAsset?: (view: CatalogueAssetView) => void;
};

export function HomeScreen({
  views,
  snapshot,
  onNavigate,
  onSelectAsset,
}: HomeScreenProps) {
  const images = views.filter((v) => v.asset.mime_type.startsWith("image/"));
  const recentViews = views.slice(0, 4);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>PixelDrive</Text>
          <Text style={styles.subtitle}>A quieter way to find your archive</Text>
        </View>
        <Pressable
          onPress={() => onNavigate?.("Sources")}
          style={styles.sourceBadge}
        >
          <MaterialIcons name="storage" size={14} color="#50D4FF" />
          <Text style={styles.sourceBadgeText}>
            {snapshot.source_occurrences.length} occurrences
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => onNavigate?.("Search")}
        style={styles.searchBar}
      >
        <MaterialIcons name="search" size={20} color="#50D4FF" />
        <Text style={styles.searchPlaceholder}>Search files, notes, and memories</Text>
        <MaterialIcons name="arrow-forward" size={18} color="#A8B4C8" />
      </Pressable>

      <View style={styles.securityCard}>
        <View style={styles.iconCircle}>
          <MaterialIcons name="lock" size={18} color="#56D49A" />
        </View>
        <View style={styles.securityText}>
          <Text style={styles.securityTitle}>Your sources stay read-only</Text>
          <Text style={styles.securitySub}>
            Link one or more Google Drives or local sources. PixelDrive never changes originals.
          </Text>
        </View>
      </View>

      {snapshot.capability_state.search !== "ready" ? (
        <CapabilityBanner
          serviceName="Search service"
          status={snapshot.capability_state.search}
          detail="Deterministic catalogue browse remains active offline."
        />
      ) : null}

      <View style={styles.quickNav}>
        <Pressable onPress={() => onNavigate?.("Images")} style={styles.navTile}>
          <MaterialIcons name="image" size={22} color="#50D4FF" />
          <Text style={styles.navTileTitle}>Images</Text>
          <Text style={styles.navTileMeta}>{images.length} items</Text>
        </Pressable>
        <Pressable onPress={() => onNavigate?.("Library")} style={styles.navTile}>
          <MaterialIcons name="folder" size={22} color="#50D4FF" />
          <Text style={styles.navTileTitle}>Library</Text>
          <Text style={styles.navTileMeta}>{views.length} assets</Text>
        </Pressable>
        <Pressable onPress={() => onNavigate?.("Sources")} style={styles.navTile}>
          <MaterialIcons name="storage" size={22} color="#50D4FF" />
          <Text style={styles.navTileTitle}>Sources</Text>
          <Text style={styles.navTileMeta}>{snapshot.discovered_sources.length} sources</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Recent Assets</Text>
        <Pressable onPress={() => onNavigate?.("Library")}>
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>

      {recentViews.length > 0 ? (
        recentViews.map((item) => (
          <AssetCard
            key={item.asset.asset_id}
            view={item}
            onPress={() => onSelectAsset?.(item)}
          />
        ))
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No assets catalogued yet. Import a source from Sources.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 18,
    gap: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: "#F4F7FB",
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "#A8B4C8",
    fontSize: 12,
    marginTop: 2,
  },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#50D4FF17",
    borderColor: "#50D4FF4A",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sourceBadgeText: {
    color: "#50D4FF",
    fontSize: 11,
    fontWeight: "700",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#11192C",
    borderColor: "#263554",
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
  },
  searchPlaceholder: {
    color: "#A8B4C8",
    fontSize: 13,
    flex: 1,
  },
  securityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#17233B",
    borderColor: "#263554",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#56D49A1C",
    alignItems: "center",
    justifyContent: "center",
  },
  securityText: {
    flex: 1,
    gap: 2,
  },
  securityTitle: {
    color: "#F4F7FB",
    fontSize: 13,
    fontWeight: "700",
  },
  securitySub: {
    color: "#A8B4C8",
    fontSize: 11,
    lineHeight: 15,
  },
  quickNav: {
    flexDirection: "row",
    gap: 8,
  },
  navTile: {
    flex: 1,
    backgroundColor: "#11192C",
    borderColor: "#263554",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  navTileTitle: {
    color: "#F4F7FB",
    fontSize: 12,
    fontWeight: "700",
  },
  navTileMeta: {
    color: "#A8B4C8",
    fontSize: 10,
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  sectionTitle: {
    color: "#F4F7FB",
    fontSize: 15,
    fontWeight: "800",
  },
  seeAll: {
    color: "#50D4FF",
    fontSize: 12,
    fontWeight: "700",
  },
  empty: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "#A8B4C8",
    fontSize: 12,
    textAlign: "center",
  },
});

