import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AssetCard } from "../../components/catalogue/asset-card";
import { browseCatalogue } from "../../lib/catalogue/browse";
import type { CatalogueAssetView } from "../../lib/catalogue/types";
import { offlineArchiveAnswer } from "../../lib/search/offline-answer";
import { trpc } from "../../lib/trpc";

export type SearchScreenProps = {
  views: CatalogueAssetView[];
  onSelectAsset?: (view: CatalogueAssetView) => void;
};

type AIResult = {
  offline?: boolean;
  answer: string;
  supporting_assets?: { asset_id: string }[];
  limitations?: string[];
};

const SUGGESTED_PROMPTS = [
  "Where are my speaker wires?",
  "Find duplicate files in the archive",
  "Show project brief and documents",
  "Find weekend memes",
];

export function SearchScreen({ views, onSelectAsset }: SearchScreenProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"Browse" | "Ask">("Browse");
  const [filter, setFilter] = useState("All");
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [isAsking, setIsAsking] = useState(false);

  let askMutation: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    askMutation = trpc.ai.askArchive.useMutation();
  } catch {
    askMutation = null;
  }

  const categories = [
    "All",
    "Photos",
    "Videos",
    "Documents",
    "Writing",
    "Memes",
  ];

  const results = useMemo(() => {
    return browseCatalogue(views, query, {
      category: filter === "All" ? undefined : filter,
    });
  }, [views, query, filter]);

  const supportingViews = useMemo(() => {
    if (!aiResult?.supporting_assets?.length) return [];
    const idSet = new Set(aiResult.supporting_assets.map((a) => a.asset_id));
    return views.filter((v) => idSet.has(v.asset.asset_id));
  }, [views, aiResult]);

  const handleAsk = async (questionText?: string) => {
    const q = (questionText ?? query).trim();
    if (!q) return;

    if (questionText) {
      setQuery(questionText);
    }

    setIsAsking(true);
    setAiResult(null);

    try {
      if (askMutation) {
        const response = await askMutation.mutateAsync({ question: q });
        setAiResult({
          answer: response.answer,
          supporting_assets: response.supporting_assets?.map((c: any) => ({
            asset_id: c.asset_id,
          })),
          limitations: response.limitations,
        });
        return;
      }
      throw new Error("tRPC client unavailable");
    } catch {
      setAiResult(offlineArchiveAnswer(views, q));
    } finally {
      setIsAsking(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search</Text>
      <Text style={styles.subtitle}>
        Start with catalogue browse. Ask the archive when you need broader
        synthesis.
      </Text>

      <View style={styles.modeToggle}>
        <Pressable
          onPress={() => setMode("Browse")}
          style={[
            styles.toggleBtn,
            mode === "Browse" && styles.toggleBtnActive,
          ]}
        >
          <MaterialIcons
            name="list"
            size={16}
            color={mode === "Browse" ? "#50D4FF" : "#A8B4C8"}
          />
          <Text
            style={[
              styles.toggleText,
              mode === "Browse" && styles.toggleTextActive,
            ]}
          >
            Catalogue browse
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("Ask")}
          style={[styles.toggleBtn, mode === "Ask" && styles.toggleBtnActive]}
        >
          <MaterialIcons
            name="auto-awesome"
            size={15}
            color={mode === "Ask" ? "#50D4FF" : "#A8B4C8"}
          />
          <Text
            style={[
              styles.toggleText,
              mode === "Ask" && styles.toggleTextActive,
            ]}
          >
            Ask AI
          </Text>
        </Pressable>
      </View>

      <View style={styles.inputWrap}>
        <MaterialIcons
          name={mode === "Browse" ? "search" : "auto-awesome"}
          size={20}
          color="#50D4FF"
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => {
            if (mode === "Ask") {
              void handleAsk();
            }
          }}
          returnKeyType={mode === "Ask" ? "send" : "search"}
          placeholder={
            mode === "Browse"
              ? "Filter by name, tag, category..."
              : "Ask a question about your archive..."
          }
          placeholderTextColor="#A8B4C8"
          style={styles.input}
        />
        {query ? (
          <Pressable
            onPress={() => {
              setQuery("");
              if (mode === "Ask") {
                setAiResult(null);
              }
            }}
            style={styles.inputAction}
          >
            <MaterialIcons name="close" size={18} color="#A8B4C8" />
          </Pressable>
        ) : null}
        {mode === "Ask" && (
          <Pressable
            onPress={() => void handleAsk()}
            disabled={!query.trim() || isAsking}
            style={[
              styles.sendBtn,
              (!query.trim() || isAsking) && styles.sendBtnDisabled,
            ]}
          >
            <MaterialIcons name="arrow-upward" size={18} color="#080D18" />
          </Pressable>
        )}
      </View>

      {mode === "Browse" ? (
        <>
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
            data={results}
            keyExtractor={(item) => item.asset.asset_id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <AssetCard view={item} onPress={() => onSelectAsset?.(item)} />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <MaterialIcons name="search-off" size={32} color="#A8B4C8" />
                <Text style={styles.emptyTitle}>No matching assets</Text>
                <Text style={styles.emptySub}>
                  {query
                    ? "Try a different term or check your filters."
                    : "Enter keywords above to browse the catalogue."}
                </Text>
              </View>
            }
          />
        </>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.aiScroll}
        >
          {/* Quick suggestions when no query or before asking */}
          {!aiResult && !isAsking ? (
            <View style={styles.promptSection}>
              <Text style={styles.promptHeader}>Suggested Questions</Text>
              <View style={styles.promptList}>
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <Pressable
                    key={prompt}
                    onPress={() => void handleAsk(prompt)}
                    style={styles.promptChip}
                  >
                    <MaterialIcons
                      name="chat-bubble-outline"
                      size={14}
                      color="#50D4FF"
                    />
                    <Text style={styles.promptText}>{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* Loading spinner */}
          {isAsking ? (
            <View style={styles.thinkingCard}>
              <ActivityIndicator size="large" color="#50D4FF" />
              <Text style={styles.thinkingTitle}>
                Consulting Ollama Archive Assistant
              </Text>
              <Text style={styles.thinkingSub}>
                Reasoning over local catalogue metadata, OCR transcripts, and
                visual descriptions...
              </Text>
            </View>
          ) : null}

          {/* AI Result Card */}
          {aiResult ? (
            <View style={styles.aiResultCard}>
              <View style={styles.aiCardHeader}>
                <View style={styles.aiBadge}>
                  <MaterialIcons
                    name="auto-awesome"
                    size={16}
                    color="#50D4FF"
                  />
                  <Text style={styles.aiBadgeText}>
                    {aiResult.offline
                      ? "Local catalogue matches"
                      : "Archive Synthesis"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setAiResult(null);
                    setQuery("");
                  }}
                  style={styles.clearBtn}
                >
                  <Text style={styles.clearBtnText}>Ask Another</Text>
                </Pressable>
              </View>

              <Text style={styles.aiAnswerText}>{aiResult.answer}</Text>

              {aiResult.limitations && aiResult.limitations.length > 0 ? (
                <View style={styles.limitationsBox}>
                  <MaterialIcons
                    name="info-outline"
                    size={14}
                    color="#A8B4C8"
                  />
                  <Text style={styles.limitationsText}>
                    {aiResult.limitations.join("; ")}
                  </Text>
                </View>
              ) : null}

              {/* Supporting Citations */}
              {supportingViews.length > 0 ? (
                <View style={styles.supportingSection}>
                  <Text style={styles.supportingTitle}>
                    Cited Supporting Records ({supportingViews.length})
                  </Text>
                  {supportingViews.map((item) => (
                    <AssetCard
                      key={item.asset.asset_id}
                      view={item}
                      onPress={() => onSelectAsset?.(item)}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Grounded catalogue files matching current query words */}
          {query.trim().length > 0 && !isAsking ? (
            <View style={styles.matchingSection}>
              <Text style={styles.sectionTitle}>Catalogue Matches</Text>
              {results.slice(0, 5).map((item) => (
                <AssetCard
                  key={item.asset.asset_id}
                  view={item}
                  onPress={() => onSelectAsset?.(item)}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
      )}
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
  modeToggle: {
    flexDirection: "row",
    backgroundColor: "#11192C",
    borderRadius: 10,
    padding: 3,
    marginTop: 14,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: "#17233B",
  },
  toggleText: {
    color: "#A8B4C8",
    fontSize: 11,
    fontWeight: "700",
  },
  toggleTextActive: {
    color: "#50D4FF",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#11192C",
    borderColor: "#263554",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  input: {
    flex: 1,
    color: "#F4F7FB",
    fontSize: 13,
  },
  inputAction: {
    padding: 4,
  },
  sendBtn: {
    backgroundColor: "#50D4FF",
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#263554",
    opacity: 0.6,
  },
  filterStrip: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingVertical: 10,
  },
  filterChip: {
    minHeight: 44,
    justifyContent: "center",
    backgroundColor: "#11192C",
    borderColor: "#263554",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: "#50D4FF22",
    borderColor: "#50D4FF",
  },
  filterText: {
    color: "#A8B4C8",
    fontSize: 11,
    fontWeight: "700",
  },
  filterTextActive: {
    color: "#50D4FF",
  },
  list: {
    paddingVertical: 10,
  },
  aiScroll: {
    paddingVertical: 14,
    gap: 16,
  },
  promptSection: {
    backgroundColor: "#11192C",
    borderColor: "#263554",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  promptHeader: {
    color: "#A8B4C8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  promptList: {
    gap: 8,
  },
  promptChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#17233B",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  promptText: {
    color: "#F4F7FB",
    fontSize: 12,
    fontWeight: "600",
  },
  thinkingCard: {
    backgroundColor: "#11192C",
    borderColor: "#50D4FF44",
    borderWidth: 1,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    gap: 10,
  },
  thinkingTitle: {
    color: "#F4F7FB",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  thinkingSub: {
    color: "#A8B4C8",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
  aiResultCard: {
    backgroundColor: "#11192C",
    borderColor: "#50D4FF55",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  aiCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#50D4FF17",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  aiBadgeText: {
    color: "#50D4FF",
    fontSize: 11,
    fontWeight: "700",
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearBtnText: {
    color: "#50D4FF",
    fontSize: 11,
    fontWeight: "600",
  },
  aiAnswerText: {
    color: "#F4F7FB",
    fontSize: 13,
    lineHeight: 20,
  },
  limitationsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#17233B",
    padding: 8,
    borderRadius: 8,
  },
  limitationsText: {
    color: "#A8B4C8",
    fontSize: 10,
    flex: 1,
  },
  supportingSection: {
    marginTop: 6,
    gap: 8,
  },
  supportingTitle: {
    color: "#50D4FF",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  matchingSection: {
    gap: 10,
    marginTop: 8,
  },
  sectionTitle: {
    color: "#A8B4C8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
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
    textAlign: "center",
  },
});
