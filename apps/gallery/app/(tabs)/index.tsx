import { useRouter } from "expo-router";
import React, { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AssetDetailSheet } from "../../components/catalogue/asset-detail-sheet";
import { galleryTheme as t } from "../../constants/gallery-theme";
import { useCatalogue } from "../../features/catalogue/catalogue-provider";
import { LibraryScreen } from "../../features/library/library-screen";
import { hasDemoAssets } from "../../lib/catalogue/demo";
export default function LibraryRoute() {
  const router = useRouter();
  const { views, snapshot, loading, error, annotateAsset, loadDemo, exitDemo } =
    useCatalogue();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    views.find((view) => view.asset.asset_id === selectedId) ?? null;
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.background }}
      edges={["top", "left", "right"]}
    >
      <View style={{ flex: 1 }}>
        <LibraryScreen
          views={views}
          loading={loading}
          error={error}
          demo={hasDemoAssets(snapshot)}
          onSelectAsset={(view) => setSelectedId(view.asset.asset_id)}
          onAddSource={() => router.navigate("/sources")}
          onSearch={() => router.navigate("/search")}
          onTryDemo={() => {
            void loadDemo().catch(() => undefined);
          }}
          onExitDemo={() => {
            void exitDemo().catch(() => undefined);
          }}
        />
        <AssetDetailSheet
          view={selected}
          onClose={() => setSelectedId(null)}
          onApproveReview={(id) => {
            void annotateAsset(id, { reviewState: "APPROVED" }).catch(
              () => undefined,
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}
