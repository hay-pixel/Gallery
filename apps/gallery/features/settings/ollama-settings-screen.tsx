import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Notice, ScreenHeading } from "../../components/gallery/primitives";
import { galleryTheme as t } from "../../constants/gallery-theme";
import type { OllamaHealth, OllamaModel } from "../../lib/ollama/types";
export type OllamaSettingsScreenProps = {
  health: OllamaHealth;
  models: OllamaModel[];
};
export function OllamaSettingsScreen({
  health,
  models,
}: OllamaSettingsScreenProps) {
  return (
    <ScrollView contentContainerStyle={s.page}>
      <ScreenHeading
        title="Private AI"
        subtitle="Optional help finding and understanding your files."
      />
      <Notice
        text={
          health.state === "ready"
            ? "Private AI is connected."
            : "Private AI is unavailable. You can still browse and search your saved library."
        }
      />
      <Text style={s.body}>{health.detail}</Text>
      <Text accessibilityRole="header" style={s.label}>
        Models
      </Text>
      {models.length ? (
        models.map((model) => (
          <View key={model.name} style={s.card}>
            <Text style={s.name}>{model.name}</Text>
            <Text style={s.body}>{model.capabilities.join(" · ")}</Text>
          </View>
        ))
      ) : (
        <Text style={s.body}>
          No model list has been reported by your backend.
        </Text>
      )}
      <Text style={s.body}>
        Your files stay available when AI is offline. Answers use file
        references so you can check where they came from.
      </Text>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: {
    padding: 20,
    gap: 16,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingBottom: 40,
  },
  body: { color: t.muted, fontSize: 14, lineHeight: 23 },
  label: { color: t.text, fontSize: 16, fontWeight: "600", marginTop: 12 },
  card: {
    padding: 18,
    borderWidth: 1,
    borderColor: t.border,
    borderRadius: 16,
    gap: 8,
  },
  name: { color: t.text, fontSize: 15 },
});
