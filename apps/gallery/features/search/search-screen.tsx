import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AssetCard } from "../../components/catalogue/asset-card";
import {
  ActionButton,
  FilterChips,
  LoadingState,
  ScreenHeading,
} from "../../components/gallery/primitives";
import { galleryTheme as t } from "../../constants/gallery-theme";
import { browseCatalogue } from "../../lib/catalogue/browse";
import type { CatalogueAssetView } from "../../lib/catalogue/types";
import { offlineArchiveAnswer } from "../../lib/search/offline-answer";
export type ArchiveAnswer = {
  answer: string;
  supporting_assets?: { asset_id: string }[];
  limitations?: string[];
  offline?: boolean;
};
export type SearchScreenProps = {
  views: CatalogueAssetView[];
  onSelectAsset?: (view: CatalogueAssetView) => void;
  onAsk?: (question: string) => Promise<ArchiveAnswer>;
};
export function SearchScreen({
  views,
  onSelectAsset,
  onAsk,
}: SearchScreenProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("Files");
  const [answer, setAnswer] = useState<ArchiveAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const filtered = useMemo(
    () => browseCatalogue(views, query, { showSidecars: false }),
    [views, query],
  );
  const shown =
    mode === "Files"
      ? filtered
      : views.filter((view) =>
          answer?.supporting_assets?.some(
            (asset) => asset.asset_id === view.asset.asset_id,
          ),
        );
  const ask = async () => {
    if (!query.trim() || asking) return;
    setAsking(true);
    setAnswer(null);
    try {
      setAnswer(
        onAsk ? await onAsk(query.trim()) : offlineArchiveAnswer(views, query),
      );
    } catch {
      setAnswer(offlineArchiveAnswer(views, query));
    } finally {
      setAsking(false);
    }
  };
  return (
    <View style={s.page}>
      <ScreenHeading
        title="Search"
        subtitle="Find what matters, without the folder hunt."
      />
      <FilterChips
        options={["Files", "Ask AI"]}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setAnswer(null);
        }}
      />
      <Text style={s.label}>
        {mode === "Files"
          ? "Search your library"
          : "Question about your library"}
      </Text>
      <View style={s.inputWrap}>
        <MaterialIcons name="search" size={22} color={t.muted} />
        <TextInput
          accessibilityLabel={
            mode === "Files"
              ? "Search your library"
              : "Question about your library"
          }
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setAnswer(null);
          }}
          placeholder={
            mode === "Files"
              ? "A filename, a tag, a few words…"
              : "What are you looking for?"
          }
          placeholderTextColor={t.muted}
          style={s.input}
          returnKeyType={mode === "Files" ? "search" : "send"}
          onSubmitEditing={() => {
            if (mode === "Ask AI") void ask();
          }}
        />
        {query ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => {
              setQuery("");
              setAnswer(null);
            }}
            style={s.clear}
          >
            <MaterialIcons name="close" size={20} color={t.muted} />
          </Pressable>
        ) : null}
      </View>
      {mode === "Ask AI" ? (
        <View style={{ marginBottom: 16 }}>
          <ActionButton
            label="Ask your library"
            onPress={() => {
              void ask();
            }}
            disabled={!query.trim() || asking}
            icon="auto-awesome"
          />
        </View>
      ) : null}
      {asking ? <LoadingState label="Checking your library…" /> : null}
      {answer ? (
        <View style={s.answer}>
          <View style={s.answerLabel}>
            <MaterialIcons
              name={answer.offline ? "search" : "auto-awesome"}
              size={17}
              color={t.accent}
            />
            <Text style={s.answerTitle}>
              {answer.offline ? "Local catalogue matches" : "Archive answer"}
            </Text>
          </View>
          <Text selectable style={s.answerText}>
            {answer.answer}
          </Text>
          {answer.limitations?.length ? (
            <Text style={s.caption}>{answer.limitations.join(" ")}</Text>
          ) : null}
        </View>
      ) : null}
      {mode === "Files" ? (
        <Text style={s.count}>
          {filtered.length} {filtered.length === 1 ? "file" : "files"}
          {query ? " found" : " in your library"}
        </Text>
      ) : null}
      <FlatList
        data={shown}
        keyExtractor={(view) => view.asset.asset_id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 30 }}
        renderItem={({ item }) => (
          <AssetCard view={item} onPress={() => onSelectAsset?.(item)} />
        )}
        ListEmptyComponent={
          !asking && !answer ? (
            <View style={s.empty}>
              <MaterialIcons
                name={mode === "Files" ? "search" : "auto-awesome"}
                size={34}
                color={t.muted}
              />
              <Text style={s.emptyTitle}>
                {mode === "Ask AI"
                  ? "A little help finding things."
                  : query
                    ? "No matching files"
                    : "Your search starts here."}
              </Text>
              <Text style={s.emptyText}>
                {mode === "Ask AI"
                  ? "Ask about the files in your library. If private AI is offline, local search is still here for you."
                  : views.length
                    ? "Try a filename or a word you remember."
                    : "Connect a source or import a collection to start finding your files."}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}
const s = StyleSheet.create({
  page: {
    flex: 1,
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingHorizontal: 20,
    backgroundColor: t.background,
  },
  label: { color: t.muted, fontSize: 13, marginBottom: 9 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingLeft: 15,
    paddingRight: 5,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    backgroundColor: t.surface,
    gap: 10,
    marginBottom: 18,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: t.text,
    fontSize: 15,
    paddingVertical: 16,
  },
  clear: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  count: { color: t.muted, fontSize: 13, paddingVertical: 6, marginBottom: 8 },
  answer: {
    backgroundColor: t.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: t.border,
    gap: 13,
    marginBottom: 16,
  },
  answerLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  answerTitle: { color: t.accent, fontSize: 13, fontWeight: "600" },
  answerText: { color: t.text, fontSize: 15, lineHeight: 24 },
  caption: { color: t.muted, fontSize: 13, lineHeight: 21 },
  empty: { alignItems: "center", gap: 14, paddingVertical: 58 },
  emptyTitle: {
    color: t.text,
    fontSize: 21,
    fontWeight: "500",
    textAlign: "center",
  },
  emptyText: {
    color: t.muted,
    fontSize: 14,
    lineHeight: 23,
    textAlign: "center",
    maxWidth: 320,
  },
});
