import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { IconButton, ScreenHeading } from "../../components/gallery/primitives";
import { galleryTheme as t } from "../../constants/gallery-theme";
import type { GalleryCatalogueSnapshotV1 } from "../../lib/catalogue/types";
import { OllamaSettingsScreen } from "./ollama-settings-screen";
export type SettingsScreenProps = {
  snapshot: GalleryCatalogueSnapshotV1;
  backendState?: "connected" | "offline" | "checking";
  aiReachable?: boolean;
};
export function SettingsScreen({
  snapshot,
  backendState = "offline",
  aiReachable = false,
}: SettingsScreenProps) {
  const [showAI, setShowAI] = useState(false);
  if (showAI)
    return (
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <IconButton
            label="Back to settings"
            icon="arrow-back"
            onPress={() => setShowAI(false)}
          />
        </View>
        <OllamaSettingsScreen
          health={{
            state: aiReachable ? "ready" : "unavailable",
            defaultModel: null,
            detail: aiReachable
              ? "Your backend reports a reachable private AI service."
              : "Your backend has not reported a reachable private AI service.",
          }}
          models={[]}
        />
      </View>
    );
  return (
    <ScrollView
      style={{ backgroundColor: t.background }}
      contentContainerStyle={s.page}
    >
      <ScreenHeading
        title="Settings"
        subtitle="A little clarity about your library."
      />
      <Text style={s.section}>Connections</Text>
      <View style={s.card}>
        <View style={s.row}>
          <MaterialIcons name="cloud-queue" size={23} color={t.accent} />
          <Text style={s.label}>Gallery backend</Text>
          <Text
            style={[
              s.status,
              { color: backendState === "connected" ? t.accent : t.muted },
            ]}
          >
            {backendState === "checking"
              ? "Checking…"
              : backendState === "connected"
                ? "Connected"
                : "Offline"}
          </Text>
        </View>
        <Text style={s.body}>
          Your saved library stays available on this device when the backend is
          offline.
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setShowAI(true)}
        style={s.card}
      >
        <View style={s.row}>
          <MaterialIcons name="auto-awesome" size={23} color={t.accent} />
          <Text style={s.label}>Private AI</Text>
          <MaterialIcons name="chevron-right" size={22} color={t.muted} />
        </View>
        <Text style={s.body}>
          {aiReachable
            ? "Available for questions about your files."
            : "Optional. Local file search works without it."}
        </Text>
      </Pressable>
      <Text style={s.section}>On this device</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.label}>Saved files</Text>
          <Text style={s.value}>{snapshot.canonical_assets.length}</Text>
        </View>
        <View style={s.divider} />
        <Text style={s.body}>
          Imports and review decisions are saved here. Cross-device recovery is
          not set up yet.
        </Text>
      </View>
      <Text style={s.section}>Your originals stay yours</Text>
      <View style={s.card}>
        <MaterialIcons name="lock-outline" size={25} color={t.accent} />
        <Text style={s.body}>
          Gallery reads connected sources. Organizing your library never
          renames, moves, or deletes the original files.
        </Text>
      </View>
      <Text style={s.footer}>Gallery · A home for your files.</Text>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    gap: 14,
  },
  section: {
    color: t.text,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 1,
  },
  card: {
    backgroundColor: t.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: t.border,
    padding: 18,
    gap: 14,
  },
  row: { flexDirection: "row", gap: 12, alignItems: "center", minHeight: 30 },
  label: { color: t.text, fontSize: 15, flex: 1, minWidth: 0 },
  status: { fontSize: 12 },
  value: { color: t.accent, fontSize: 18, fontWeight: "600" },
  body: { color: t.muted, fontSize: 14, lineHeight: 23 },
  divider: { height: 1, backgroundColor: t.border },
  footer: { color: t.muted, fontSize: 12, marginTop: 20, textAlign: "center" },
});
