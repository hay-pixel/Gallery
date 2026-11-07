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
import { browseCatalogue } from "../../lib/catalogue/browse";
import type { CatalogueAssetView } from "../../lib/catalogue/types";

export type SearchScreenProps = {
  views: CatalogueAssetView[];
  onSelectAsset?: (view: CatalogueAssetView) => void;
};

export function SearchScreen({ views, onSelectAsset }: SearchScreenProps) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"Browse" | "Ask">("Browse");

  const results = useMemo(() => {
    return browseCatalogue(views, query);
  }, [views, query]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search</Text>
      <Text style={styles.subtitle}>
        Start with catalogue browse. Ask the archive when you need broader synthesis.
      </Text>

      <View style={styles.modeToggle}>
        <Pressable
          onPress={() => setMode("Browse")}
          style={[styles.toggleBtn, mode === "Browse" && styles.toggleBtnActive]}
        >
          <Text style={[styles.toggleText, mode === "Browse" && styles.toggleTextActive]}>
            Catalogue browse
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("Ask")}
          style={[styles.toggleBtn, mode === "Ask" && styles.toggleBtnActive]}
        >
          <Text style={[styles.toggleText, mode === "Ask" && styles.toggleTextActive]}>
            Ask AI
          </Text>
        </Pressable>
      </View>

      <View style={styles.inputWrap}>
        <MaterialIcons name="search" size={20} color="#50D4FF" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={mode === "Browse" ? "Filter by name, tag, category..." : "Ask a question about your archive..."}
          placeholderTextColor="#A8B4C8"
          style={styles.input}
        />
        {query ? (
          <Pressable onPress={() => setQuery("")}>
            <MaterialIcons name="close" size={18} color="#A8B4C8" />
          </Pressable>
        ) : null}
      </View>

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
    paddingVertical: 8,
    alignItems: "center",
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
    paddingVertical: 10,
    marginTop: 12,
  },
  input: {
    flex: 1,
    color: "#F4F7FB",
    fontSize: 13,
  },
  list: {
    paddingVertical: 14,
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

