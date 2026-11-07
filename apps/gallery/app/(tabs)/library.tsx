import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AssetDetailSheet } from "../../components/catalogue/asset-detail-sheet";
import { useCatalogue } from "../../features/catalogue/catalogue-provider";
import { LibraryScreen } from "../../features/library/library-screen";
import type { CatalogueAssetView } from "../../lib/catalogue/types";

export default function LibraryRoute() {
  const { views, annotateAsset } = useCatalogue();
  const [selectedAsset, setSelectedAsset] = useState<CatalogueAssetView | null>(null);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <LibraryScreen views={views} onSelectAsset={setSelectedAsset} />
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
