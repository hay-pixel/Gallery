import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { GalleryCatalogueSnapshotV1 } from "../../lib/catalogue/types";
import { LocalSourceBrowser } from "./local-source-browser";

export type SourcesScreenProps = {
  snapshot: GalleryCatalogueSnapshotV1;
  onImportSuccess?: () => void;
  onConnectDrive?: () => void;
  onTriggerPicker?: () => void;
};

export function SourcesScreen({
  snapshot,
  onImportSuccess: _onImportSuccess,
  onConnectDrive,
  onTriggerPicker,
}: SourcesScreenProps) {
  const [showBrowser, setShowBrowser] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Sources</Text>
          <Text style={styles.subtitle}>Keep each provider separate and read-only</Text>
        </View>
        <View style={styles.iconCircle}>
          <MaterialIcons name="storage" size={20} color="#50D4FF" />
        </View>
      </View>

      <View style={styles.explainer}>
        <MaterialIcons name="lock" size={18} color="#56D49A" />
        <Text style={styles.explainerText}>
          You can link multiple Google Drives, local archives, and Extract exports. Each remains a separate, read-only source with independent provenance.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Connected Sources</Text>

      <View style={styles.sourceItem}>
        <View style={styles.sourceGlyph}>
          <MaterialIcons name="folder-shared" size={20} color="#50D4FF" />
        </View>
        <View style={styles.sourceInfo}>
          <Text style={styles.sourceName}>Canonical Archive</Text>
          <Text style={styles.sourceSub}>
            {snapshot.canonical_assets.length} canonical assets · {snapshot.source_occurrences.length} occurrences
          </Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>Connected read-only</Text>
          </View>
        </View>
      </View>

      <Pressable onPress={onConnectDrive} style={styles.actionCard}>
        <View style={styles.plus}>
          <MaterialIcons name="add" size={20} color="#080D18" />
        </View>
        <View style={styles.actionInfo}>
          <Text style={styles.actionTitle}>Connect a Google Drive</Text>
          <Text style={styles.actionSub}>Choose an account or shared Drive to view read-only.</Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#50D4FF" />
      </Pressable>

      <Pressable onPress={() => setShowBrowser(true)} style={styles.actionCard}>
        <View style={[styles.plus, { backgroundColor: "#56D49A" }]}>
          <MaterialIcons name="smartphone" size={20} color="#080D18" />
        </View>
        <View style={styles.actionInfo}>
          <Text style={[styles.actionTitle, { color: "#56D49A" }]}>Browse local device</Text>
          <Text style={styles.actionSub}>Discover photos and files on this device.</Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#56D49A" />
      </Pressable>

      <Pressable onPress={onTriggerPicker} style={styles.actionCard}>
        <View style={[styles.plus, { backgroundColor: "#9A7DFF" }]}>
          <MaterialIcons name="file-download" size={20} color="#080D18" />
        </View>
        <View style={styles.actionInfo}>
          <Text style={[styles.actionTitle, { color: "#9A7DFF" }]}>Import canonical JSON</Text>
          <Text style={styles.actionSub}>Atomically merge an Extract export or asset bundle.</Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color="#9A7DFF" />
      </Pressable>

      <LocalSourceBrowser
        visible={showBrowser}
        accessState="granted"
        items={snapshot.discovered_sources}
        onClose={() => setShowBrowser(false)}
        onPickDocument={() => onTriggerPicker?.()}
      />
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
  explainer: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#56D49A15",
    borderWidth: 1,
    borderColor: "#56D49A4D",
    borderRadius: 12,
    padding: 12,
  },
  explainerText: {
    color: "#56D49A",
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },
  sectionTitle: {
    color: "#F4F7FB",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
  },
  sourceItem: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#11192C",
    borderWidth: 1,
    borderColor: "#263554",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  sourceGlyph: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#17233B",
    alignItems: "center",
    justifyContent: "center",
  },
  sourceInfo: {
    flex: 1,
    gap: 3,
  },
  sourceName: {
    color: "#F4F7FB",
    fontSize: 13,
    fontWeight: "700",
  },
  sourceSub: {
    color: "#A8B4C8",
    fontSize: 11,
  },
  pill: {
    alignSelf: "flex-start",
    backgroundColor: "#50D4FF1A",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  pillText: {
    color: "#50D4FF",
    fontSize: 9,
    fontWeight: "700",
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#50D4FF66",
    borderRadius: 12,
    padding: 12,
  },
  plus: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#50D4FF",
    alignItems: "center",
    justifyContent: "center",
  },
  actionInfo: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    color: "#50D4FF",
    fontSize: 13,
    fontWeight: "700",
  },
  actionSub: {
    color: "#A8B4C8",
    fontSize: 11,
  },
});

