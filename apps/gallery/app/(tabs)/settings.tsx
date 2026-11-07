import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCatalogue } from "../../features/catalogue/catalogue-provider";
import { SettingsScreen } from "../../features/settings/settings-screen";

export default function SettingsRoute() {
  const { snapshot } = useCatalogue();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <SettingsScreen snapshot={snapshot} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080D18" },
  root: { flex: 1, backgroundColor: "#080D18" },
});
