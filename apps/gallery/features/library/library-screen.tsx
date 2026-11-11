import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { AssetCard } from "../../components/catalogue/asset-card";
import {
  ActionButton,
  FilterChips,
  IconButton,
  LoadingState,
  Notice,
  ScreenHeading,
} from "../../components/gallery/primitives";
import { galleryTheme as t } from "../../constants/gallery-theme";
import { browseCatalogue } from "../../lib/catalogue/browse";
import type { CatalogueAssetView } from "../../lib/catalogue/types";

export type LibraryScreenProps = {
  views: CatalogueAssetView[];
  onSelectAsset?: (view: CatalogueAssetView) => void;
  onNavigateReviews?: () => void;
  onNavigateDuplicates?: () => void;
  onAddSource?: () => void;
  onSearch?: () => void;
  onTryDemo?: () => void;
  onExitDemo?: () => void;
  demo?: boolean;
  loading?: boolean;
  error?: string | null;
  initialFilter?: string;
  title?: string;
};
export function LibraryScreen({
  views,
  onSelectAsset,
  onNavigateReviews,
  onNavigateDuplicates,
  onAddSource,
  onSearch,
  onTryDemo,
  onExitDemo,
  demo,
  loading,
  error,
  initialFilter = "All",
  title = "Your library",
}: LibraryScreenProps) {
  const [filter, setFilter] = useState(initialFilter);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [width, setWidth] = useState(350);
  const columns =
    layout === "list" ? 1 : width >= 850 ? 4 : width >= 580 ? 3 : 2;
  const tileWidth = Math.floor((width - (columns - 1) * 12) / columns);
  const filtered = useMemo(
    () =>
      browseCatalogue(views, "", { showSidecars: false })
        .filter((view) => {
          if (filter === "Images")
            return view.asset.mime_type.startsWith("image/");
          if (filter === "Videos")
            return view.asset.mime_type.startsWith("video/");
          if (filter === "Documents")
            return !/^(image|video)\//.test(view.asset.mime_type);
          if (filter === "Needs review")
            return view.annotations.reviewState === "NEEDS_REVIEW";
          if (filter === "Duplicates") return view.occurrences.length > 1;
          return true;
        })
        .sort(
          (a, b) =>
            Number(b.asset.mime_type.startsWith("image/")) -
            Number(a.asset.mime_type.startsWith("image/")),
        ),
    [views, filter],
  );
  const empty = !views.length;
  const changeFilter = (next: string) => {
    if (next === "Needs review" && onNavigateReviews) onNavigateReviews();
    if (next === "Duplicates" && onNavigateDuplicates) onNavigateDuplicates();
    setFilter(next);
  };
  return (
    <View style={s.page}>
      <ScreenHeading
        eyebrow="Gallery"
        title={title}
        subtitle={
          empty
            ? "A place for everything you want to keep."
            : "Available offline on this device."
        }
        action={
          onAddSource ? (
            <IconButton label="Add a source" icon="add" onPress={onAddSource} />
          ) : undefined
        }
      />
      {error ? <Notice error text={error} /> : null}
      {demo ? (
        <View style={s.demo}>
          <View style={{ flex: 1 }}>
            <Text style={s.demoTitle}>Sample library</Text>
            <Text style={s.small}>Demo files, not connected accounts.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onExitDemo}
            style={s.exitDemo}
          >
            <Text style={s.exitText}>Exit demo</Text>
          </Pressable>
        </View>
      ) : null}
      {!empty ? (
        <>
          {onSearch ? (
            <Pressable
              accessibilityRole="button"
              onPress={onSearch}
              style={s.search}
            >
              <MaterialIcons name="search" size={21} color={t.muted} />
              <Text style={s.searchText}>Find a file, a place, a memory…</Text>
            </Pressable>
          ) : null}
          <FilterChips
            options={[
              "All",
              "Images",
              "Videos",
              "Documents",
              "Needs review",
              "Duplicates",
            ]}
            value={filter}
            onChange={changeFilter}
          />
          <View style={s.toolbar}>
            <Text accessibilityLiveRegion="polite" style={s.small}>
              {filtered.length} {filtered.length === 1 ? "file" : "files"}
            </Text>
            <View style={{ flexDirection: "row", gap: 2 }}>
              <IconButton
                label="Grid view"
                icon="grid-view"
                selected={layout === "grid"}
                onPress={() => setLayout("grid")}
              />
              <IconButton
                label="List view"
                icon="view-agenda"
                selected={layout === "list"}
                onPress={() => setLayout("list")}
              />
            </View>
          </View>
        </>
      ) : null}
      <View
        style={{ flex: 1 }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      >
        {loading ? (
          <LoadingState />
        ) : empty ? (
          <View style={s.empty}>
            <View style={s.art}>
              <View style={s.artBack} />
              <View style={s.artFront}>
                <MaterialIcons
                  name="photo-library"
                  size={40}
                  color={t.accent}
                />
              </View>
            </View>
            <Text role="heading" aria-level={2} style={s.emptyTitle}>
              Your library starts here.
            </Text>
            <Text style={s.emptyText}>
              Connect Google Drive or import a collection. Your photos and files
              will live here, with originals left untouched.
            </Text>
            <View style={s.emptyActions}>
              {onAddSource ? (
                <ActionButton
                  label="Connect a source"
                  icon="add"
                  onPress={onAddSource}
                />
              ) : null}
              {onTryDemo ? (
                <ActionButton
                  label="Explore a demo"
                  secondary
                  onPress={onTryDemo}
                />
              ) : null}
            </View>
            <Text style={s.footnote}>Your library. Your originals.</Text>
          </View>
        ) : (
          <FlatList
            key={`${layout}-${columns}`}
            data={filtered}
            numColumns={columns}
            keyExtractor={(item) => item.asset.asset_id}
            showsVerticalScrollIndicator={false}
            columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
            contentContainerStyle={{
              gap: layout === "grid" ? 14 : 0,
              paddingBottom: 28,
            }}
            renderItem={({ item }) => (
              <View style={{ width: layout === "grid" ? tileWidth : "100%" }}>
                <AssetCard
                  view={item}
                  layout={layout}
                  onPress={() => onSelectAsset?.(item)}
                />
              </View>
            )}
            ListEmptyComponent={
              <View style={s.noMatches}>
                <MaterialIcons name="filter-list" size={28} color={t.muted} />
                <Text style={s.emptyTitle}>Nothing here yet</Text>
                <Text style={s.small}>
                  Try another filter to see more of your library.
                </Text>
                <ActionButton
                  label="Show all files"
                  secondary
                  onPress={() => setFilter("All")}
                />
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  page: {
    flex: 1,
    width: "100%",
    maxWidth: t.maxWidth,
    alignSelf: "center",
    paddingHorizontal: 20,
    backgroundColor: t.background,
  },
  search: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 15,
    backgroundColor: t.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  searchText: { color: t.muted, fontSize: 14, flexShrink: 1 },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  small: { color: t.muted, fontSize: 13, lineHeight: 20 },
  demo: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 18,
  },
  demoTitle: {
    color: t.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  exitDemo: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  exitText: { color: t.accent, fontSize: 13, fontWeight: "600" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 40,
    gap: 18,
  },
  art: {
    width: 140,
    height: 124,
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  artBack: {
    position: "absolute",
    width: 94,
    height: 110,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.border,
    backgroundColor: t.surface,
    transform: [{ rotate: "-14deg" }],
    left: 12,
    top: 3,
  },
  artFront: {
    width: 94,
    height: 110,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#41695F",
    backgroundColor: t.raised,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "9deg" }],
  },
  emptyTitle: {
    color: t.text,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "500",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  emptyText: {
    color: t.muted,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 340,
  },
  emptyActions: { width: "100%", maxWidth: 300, gap: 10, marginTop: 8 },
  footnote: { color: t.muted, fontSize: 12, marginTop: 6 },
  noMatches: { alignItems: "center", gap: 16, paddingVertical: 40 },
});
