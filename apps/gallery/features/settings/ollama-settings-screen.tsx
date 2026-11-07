import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CapabilityBanner } from "../../components/capability-banner";
import type { OllamaHealth, OllamaModel } from "../../lib/ollama/types";

export type OllamaSettingsScreenProps = {
  health: OllamaHealth;
  models: OllamaModel[];
};

export function OllamaSettingsScreen({ health, models }: OllamaSettingsScreenProps) {
  const isReady = health.state === "ready";

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Private Ollama Status</Text>
          <Text style={styles.subtitle}>
            All reasoning operations run private and project-managed behind Gallery&apos;s backend.
          </Text>
        </View>
        <View style={styles.iconCircle}>
          <MaterialIcons name="psychology" size={20} color="#50D4FF" />
        </View>
      </View>

      <CapabilityBanner
        serviceName="Ollama service"
        status={isReady ? "ready" : "unavailable"}
        detail={health.detail}
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Managed Models</Text>
        <Text style={styles.cardSub}>
          {models.length > 0
            ? `${models.length} model(s) available on backend.`
            : "No server-managed Ollama models are currently reachable."}
        </Text>

        {models.map((m) => (
          <View key={m.name} style={styles.modelRow}>
            <MaterialIcons name="memory" size={18} color="#50D4FF" />
            <View style={styles.modelInfo}>
              <Text style={styles.modelName}>{m.name}</Text>
              <Text style={styles.modelCaps}>
                Capabilities: {m.capabilities.join(", ") || "none"}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.securityNote}>
        <MaterialIcons name="security" size={16} color="#56D49A" />
        <Text style={styles.securityNoteText}>
          Security Boundary: Browser and Android clients never receive or store private Ollama server addresses, ports, or credentials.
        </Text>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    color: "#F4F7FB",
    fontSize: 20,
    fontWeight: "800",
  },
  subtitle: {
    color: "#A8B4C8",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#50D4FF17",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#11192C",
    borderColor: "#263554",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    color: "#F4F7FB",
    fontSize: 14,
    fontWeight: "800",
  },
  cardSub: {
    color: "#A8B4C8",
    fontSize: 11,
  },
  modelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#17233B",
    borderRadius: 8,
    padding: 10,
  },
  modelInfo: {
    flex: 1,
    gap: 2,
  },
  modelName: {
    color: "#F4F7FB",
    fontSize: 12,
    fontWeight: "700",
  },
  modelCaps: {
    color: "#A8B4C8",
    fontSize: 10,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#56D49A15",
    borderWidth: 1,
    borderColor: "#56D49A4D",
    borderRadius: 10,
    padding: 12,
  },
  securityNoteText: {
    color: "#56D49A",
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
});
