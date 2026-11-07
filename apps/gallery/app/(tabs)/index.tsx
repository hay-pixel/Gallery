import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AssetDetailSheet } from "../../components/catalogue/asset-detail-sheet";
import { useCatalogue } from "../../features/catalogue/catalogue-provider";
import { HomeScreen } from "../../features/home/home-screen";
import type { CatalogueAssetView } from "../../lib/catalogue/types";

export default function HomeRoute() {
  const router = useRouter();
  const { views, snapshot, annotateAsset } = useCatalogue();
  const [selectedAsset, setSelectedAsset] = useState<CatalogueAssetView | null>(null);

  const handleNavigate = (tab: "Images" | "Search" | "Library" | "Sources" | "Settings") => {
    switch (tab) {
      case "Images":
        router.push("/images");
        break;
      case "Search":
        router.push("/search");
        break;
      case "Library":
        router.push("/library");
        break;
      case "Sources":
        router.push("/sources");
        break;
      case "Settings":
        router.push("/settings");
        break;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <HomeScreen
          views={views}
          snapshot={snapshot}
          onNavigate={handleNavigate}
          onSelectAsset={setSelectedAsset}
        />
        <AssetDetailSheet
          view={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onApproveReview={(id) => {
            void annotateAsset(id, { reviewState: "APPROVED" });
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080D18" },
  root: { flex: 1, backgroundColor: "#080D18" },
});
