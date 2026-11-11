import React, { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AssetDetailSheet } from "../../components/catalogue/asset-detail-sheet";
import { Notice } from "../../components/gallery/primitives";
import { galleryTheme as t } from "../../constants/gallery-theme";
import { useCatalogue } from "../../features/catalogue/catalogue-provider";
import { SearchScreen } from "../../features/search/search-screen";
import { trpc } from "../../lib/trpc";
export default function SearchRoute() {
  const { views, annotateAsset, error } = useCatalogue();
  const ask = trpc.ai.askArchive.useMutation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: t.background }}
      edges={["top", "left", "right"]}
    >
      <View style={{ flex: 1 }}>
        {error ? <Notice error text={error} /> : null}
        <SearchScreen
          views={views}
          onSelectAsset={(view) => setSelectedId(view.asset.asset_id)}
          onAsk={(question) => ask.mutateAsync({ question })}
        />
        <AssetDetailSheet
          view={
            views.find((view) => view.asset.asset_id === selectedId) ?? null
          }
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
