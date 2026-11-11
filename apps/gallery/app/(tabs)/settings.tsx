import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCatalogue } from "../../features/catalogue/catalogue-provider";
import { galleryTheme as t } from "../../constants/gallery-theme";
import { trpc } from "../../lib/trpc";
import { SettingsScreen } from "../../features/settings/settings-screen";

export default function SettingsRoute() {
  const health = trpc.health.useQuery(undefined, { retry: false });
  const ai = trpc.ai.health.useQuery(undefined, { retry: false });
  const { snapshot } = useCatalogue();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <SettingsScreen
          snapshot={snapshot}
          backendState={
            health.data?.ok
              ? "connected"
              : health.isFetching
                ? "checking"
                : "offline"
          }
          aiReachable={ai.data?.ollama.reachable ?? false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.background },
  root: { flex: 1, backgroundColor: t.background },
});
