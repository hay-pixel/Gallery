import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { CatalogueAssetView } from "../../lib/catalogue/types";
import { formatBytes } from "../../lib/pixeldrive";

export type AssetDetailSheetProps = {
  view: CatalogueAssetView | null;
  onClose: () => void;
  onApproveReview?: (assetId: string) => void;
};

export function AssetDetailSheet({ view, onClose, onApproveReview }: AssetDetailSheetProps) {
  if (!view) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <View
                style={[
                  styles.visual,
                  { backgroundColor: view.annotations.previewColor ?? "#2F80ED" },
                ]}
              >
                <MaterialIcons name="image" size={36} color="#FFFFFF" />
              </View>
              <Text style={styles.title}>{view.displayName}</Text>
              <Text style={styles.subtitle}>
                {view.asset.mime_type} · {formatBytes(view.asset.size_bytes)}
              </Text>
              <Text style={styles.assetId} numberOfLines={1}>
                {view.asset.asset_id}
              </Text>
            </View>

            {view.annotations.reviewState === "NEEDS_REVIEW" && onApproveReview ? (
              <View style={styles.reviewPrompt}>
                <Text style={styles.reviewLabel}>Suggested category: {view.annotations.category}</Text>
                <Pressable
                  onPress={() => onApproveReview(view.asset.asset_id)}
                  style={styles.approveBtn}
                >
                  <MaterialIcons name="check" size={16} color="#080D18" />
                  <Text style={styles.approveText}>Approve Category</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Observation & Description</Text>
              <Text style={styles.sectionText}>
                {view.analysis?.visual_description ||
                  view.analysis?.ocr_text ||
                  view.annotations.userNotes ||
                  "No stored description available for this record."}
              </Text>
            </View>

            {view.analysis?.tags && view.analysis.tags.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tags (Classifier)</Text>
                <View style={styles.tagWrap}>
                  {view.analysis.tags.map((t, idx) => (
                    <View key={`${t.tag}-${idx}`} style={styles.tagChip}>
                      <Text style={styles.tagText}>{t.tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Source Occurrences ({view.occurrences.length})
              </Text>
              {view.occurrences.map((occ) => (
                <View key={occ.source_occurrence_id} style={styles.occRow}>
                  <MaterialIcons name="folder-open" size={16} color="#50D4FF" />
                  <View style={styles.occInfo}>
                    <Text style={styles.occPath}>{occ.original_path}</Text>
                    <Text style={styles.occLoc}>
                      {occ.source_kind} · {occ.source_location}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#11192C",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: "#263554",
    maxHeight: "85%",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#263554",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  content: {
    gap: 16,
  },
  header: {
    alignItems: "center",
    gap: 6,
  },
  visual: {
    width: 72,
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#F4F7FB",
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: "#A8B4C8",
    fontSize: 12,
  },
  assetId: {
    color: "#50D4FF",
    fontSize: 10,
    fontFamily: "monospace",
    maxWidth: "90%",
  },
  reviewPrompt: {
    backgroundColor: "#F6C75B1F",
    borderWidth: 1,
    borderColor: "#F6C75B50",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 8,
  },
  reviewLabel: {
    color: "#F6C75B",
    fontSize: 12,
    fontWeight: "700",
  },
  approveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#56D49A",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  approveText: {
    color: "#080D18",
    fontSize: 12,
    fontWeight: "800",
  },
  section: {
    backgroundColor: "#17233B",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  sectionTitle: {
    color: "#A8B4C8",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  sectionText: {
    color: "#F4F7FB",
    fontSize: 12,
    lineHeight: 18,
  },
  tagWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagChip: {
    backgroundColor: "#263554",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    color: "#50D4FF",
    fontSize: 11,
    fontWeight: "600",
  },
  occRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 4,
  },
  occInfo: {
    flex: 1,
    gap: 2,
  },
  occPath: {
    color: "#F4F7FB",
    fontSize: 12,
    fontWeight: "600",
  },
  occLoc: {
    color: "#A8B4C8",
    fontSize: 10,
  },
  closeBtn: {
    backgroundColor: "#263554",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  closeText: {
    color: "#F4F7FB",
    fontSize: 13,
    fontWeight: "700",
  },
});

