import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { COMPANION_TARGETS, deriveCompanionState } from "../../lib/launcher/companion";
import type { GalleryCatalogueSnapshotV1 } from "../../lib/catalogue/types";
import { OllamaSettingsScreen } from "./ollama-settings-screen";

export type SettingsScreenProps = {
  snapshot: GalleryCatalogueSnapshotV1;
};

export function SettingsScreen({ snapshot }: SettingsScreenProps) {
  const [showOllamaDetails, setShowOllamaDetails] = useState(false);

  const extractCompanion = deriveCompanionState({
    target: COMPANION_TARGETS.extract,
    installed: false,
  });

  const assistCompanion = deriveCompanionState({
    target: COMPANION_TARGETS.assist,
    installed: false,
  });

  if (showOllamaDetails) {
    return (
      <View style={styles.subScreen}>
        <Pressable onPress={() => setShowOllamaDetails(false)} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={20} color="#50D4FF" />
          <Text style={styles.backText}>Back to Settings</Text>
        </Pressable>
        <OllamaSettingsScreen
          health={{
            state: snapshot.capability_state.ollama === "ready" ? "ready" : "unavailable",
            defaultModel: null,
            detail: "Private Ollama reasoning daemon is managed server-side.",
          }}
          models={[]}
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Runtime independence and companion status</Text>
        </View>
        <View style={styles.iconCircle}>
          <MaterialIcons name="settings" size={20} color="#50D4FF" />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Companions</Text>
      <View style={styles.companionCard}>
        <MaterialIcons name="extension" size={20} color="#50D4FF" />
        <View style={styles.companionInfo}>
          <Text style={styles.companionName}>{extractCompanion.displayName}</Text>
          <Text style={styles.companionStatus}>State: {extractCompanion.state}</Text>
          <Text style={styles.companionDetail}>{extractCompanion.detail}</Text>
        </View>
      </View>

      <View style={styles.companionCard}>
        <MaterialIcons name="support-agent" size={20} color="#9A7DFF" />
        <View style={styles.companionInfo}>
          <Text style={styles.companionName}>{assistCompanion.displayName}</Text>
          <Text style={styles.companionStatus}>State: {assistCompanion.state}</Text>
          <Text style={styles.companionDetail}>{assistCompanion.detail}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Private AI & Reasoning</Text>
      <Pressable onPress={() => setShowOllamaDetails(true)} style={styles.menuRow}>
        <MaterialIcons name="psychology" size={22} color="#50D4FF" />
        <View style={styles.menuInfo}>
          <Text style={styles.menuTitle}>Private Ollama Status</Text>
          <Text style={styles.menuSub}>State: {snapshot.capability_state.ollama}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#A8B4C8" />
      </Pressable>

      <Text style={styles.sectionTitle}>Catalogue Status</Text>
      <View style={styles.infoCard}>
        <Text style={styles.infoLine}>Schema: {snapshot.schema} (v{snapshot.schema_version})</Text>
        <Text style={styles.infoLine}>Saved at: {snapshot.saved_at}</Text>
        <Text style={styles.infoLine}>Canonical assets: {snapshot.canonical_assets.length}</Text>
        <Text style={styles.infoLine}>Source occurrences: {snapshot.source_occurrences.length}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 18,
    gap: 16,
    paddingBottom: 32,
    backgroundColor: "#080D18",
  },
  subScreen: {
    flex: 1,
    backgroundColor: "#080D18",
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
  },
  backText: {
    color: "#50D4FF",
    fontSize: 13,
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#50D4FF17",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: "#F4F7FB",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
  },
  companionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#11192C",
    borderColor: "#263554",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  companionInfo: {
    flex: 1,
    gap: 3,
  },
  companionName: {
    color: "#F4F7FB",
    fontSize: 13,
    fontWeight: "700",
  },
  companionStatus: {
    color: "#50D4FF",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  companionDetail: {
    color: "#A8B4C8",
    fontSize: 11,
    lineHeight: 15,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#11192C",
    borderColor: "#263554",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  menuInfo: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    color: "#F4F7FB",
    fontSize: 13,
    fontWeight: "700",
  },
  menuSub: {
    color: "#A8B4C8",
    fontSize: 11,
    textTransform: "capitalize",
  },
  infoCard: {
    backgroundColor: "#11192C",
    borderColor: "#263554",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  infoLine: {
    color: "#A8B4C8",
    fontSize: 11,
  },
});

