import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCatalogue } from "../../features/catalogue/catalogue-provider";
import { SourcesScreen } from "../../features/sources/sources-screen";

export default function SourcesRoute() {
  const { snapshot, reloadFromCache } = useCatalogue();

  const handleTriggerPicker = async () => {
    try {
      // In web/desktop or runtime where document picker is used, pickCanonicalImport parses and merges
      // We can also connect pickDocument adapter
      await reloadFromCache();
    } catch {
      // safe fallback
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <SourcesScreen
          snapshot={snapshot}
          onImportSuccess={() => {
            void reloadFromCache();
          }}
          onTriggerPicker={handleTriggerPicker}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080D18" },
  root: { flex: 1, backgroundColor: "#080D18" },
});
