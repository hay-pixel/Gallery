import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionButton, IconButton } from "../gallery/primitives";
import { galleryTheme as t } from "../../constants/gallery-theme";
import type { CatalogueAssetView } from "../../lib/catalogue/types";
import { formatBytes } from "../../lib/pixeldrive";
import { AssetPreview } from "./asset-preview";
export type AssetDetailSheetProps = {
  view: CatalogueAssetView | null;
  onClose: () => void;
  onApproveReview?: (assetId: string) => void;
};
export function AssetDetailSheet({
  view,
  onClose,
  onApproveReview,
}: AssetDetailSheetProps) {
  const insets = useSafeAreaInsets();
  const [details, setDetails] = useState(false);
  if (!view) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.scrim}>
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <View style={s.topbar}>
            <Text style={s.topbarText}>File preview</Text>
            <IconButton
              label="Close file preview"
              icon="close"
              onPress={onClose}
            />
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 22, paddingBottom: 8 }}
          >
            <View style={s.visual}>
              <MaterialIcons
                name={
                  view.asset.mime_type.startsWith("image/")
                    ? "image"
                    : "description"
                }
                size={40}
                color={t.muted}
              />
              <AssetPreview view={view} />
            </View>
            <View>
              <Text accessibilityRole="header" selectable style={s.title}>
                {view.displayName}
              </Text>
              <Text style={s.meta}>
                {formatBytes(view.asset.size_bytes)} ·{" "}
                {view.annotations.category || view.asset.mime_type}
              </Text>
            </View>
            {view.annotations.reviewState === "NEEDS_REVIEW" &&
            onApproveReview ? (
              <View style={s.review}>
                <Text style={s.body}>
                  Suggested category: {view.annotations.category || "Unsorted"}
                </Text>
                <ActionButton
                  label="Approve category"
                  icon="check"
                  onPress={() => onApproveReview(view.asset.asset_id)}
                />
              </View>
            ) : view.annotations.reviewState === "APPROVED" ? (
              <Text style={s.approved}>✓ Reviewed</Text>
            ) : null}
            {view.analysis?.visual_description ||
            view.analysis?.ocr_text ||
            view.annotations.userNotes ? (
              <View style={{ gap: 8 }}>
                <Text style={s.section}>About this file</Text>
                <Text selectable style={s.body}>
                  {view.annotations.userNotes ||
                    view.analysis?.visual_description ||
                    view.analysis?.ocr_text}
                </Text>
              </View>
            ) : null}
            {view.analysis?.tags.length ? (
              <View style={s.tags}>
                {view.analysis.tags.map((tag) => (
                  <View key={tag.tag} style={s.tag}>
                    <Text style={s.tagText}>{tag.tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: details }}
              onPress={() => setDetails(!details)}
              style={s.detailsButton}
            >
              <Text style={s.section}>File details</Text>
              <MaterialIcons
                name={details ? "expand-less" : "expand-more"}
                size={24}
                color={t.muted}
              />
            </Pressable>
            {details ? (
              <View style={{ gap: 16 }}>
                <Text selectable style={s.hash}>
                  {view.asset.asset_id}
                </Text>
                <Text style={s.body}>
                  {view.occurrences.length} saved{" "}
                  {view.occurrences.length === 1 ? "location" : "locations"}
                </Text>
                {view.occurrences.map((occurrence) => (
                  <View
                    key={occurrence.source_occurrence_id}
                    style={s.occurrence}
                  >
                    <MaterialIcons
                      name="folder-open"
                      size={20}
                      color={t.accent}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text selectable style={s.body}>
                        {occurrence.original_path}
                      </Text>
                      <Text selectable style={s.meta}>
                        {occurrence.source_location}
                      </Text>
                    </View>
                  </View>
                ))}
                {view.asset.storage_locator.startsWith("fixture://") ? (
                  <Text style={s.meta}>
                    This is a demo record, not a connected file.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "#000000AD", justifyContent: "flex-end" },
  sheet: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    backgroundColor: t.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "93%",
    paddingHorizontal: 22,
    borderWidth: 1,
    borderColor: t.border,
  },
  topbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 66,
  },
  topbarText: { color: t.muted, fontSize: 13 },
  visual: {
    width: "100%",
    aspectRatio: 1.4,
    backgroundColor: t.raised,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: t.text,
    fontSize: 22,
    fontWeight: "500",
    lineHeight: 29,
    letterSpacing: -0.5,
  },
  meta: { color: t.muted, fontSize: 13, lineHeight: 21, marginTop: 5 },
  body: { color: t.text, fontSize: 14, lineHeight: 23 },
  section: { color: t.text, fontSize: 15, fontWeight: "600" },
  review: { backgroundColor: t.raised, borderRadius: 14, padding: 16, gap: 12 },
  approved: { color: t.accent, fontSize: 14 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: {
    backgroundColor: t.raised,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  tagText: { color: t.muted, fontSize: 12 },
  detailsButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: t.border,
    paddingTop: 8,
  },
  hash: {
    color: t.muted,
    fontSize: 11,
    fontFamily: "monospace",
    lineHeight: 18,
  },
  occurrence: { flexDirection: "row", gap: 12 },
});
