import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  DiscoveredSourceItem,
  SourceAccessState,
} from "../../lib/sources/types";

export type LocalSourceBrowserProps = {
  visible?: boolean;
  accessState: SourceAccessState;
  items: DiscoveredSourceItem[];
  onClose: () => void;
  onPickDocument: () => void;
};

export function LocalSourceBrowser({
  visible = true,
  accessState,
  items,
  onClose,
  onPickDocument,
}: LocalSourceBrowserProps) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom + 12, 28) },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.head}>
            <View>
              <Text style={styles.title}>Local Device Sources</Text>
              <Text style={styles.subtitle}>
                Discovered media items remain source-only until canonicalized.
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeIcon}>
              <MaterialIcons name="close" size={20} color="#A8B4C8" />
            </Pressable>
          </View>

          {accessState === "unavailable" ? (
            <View style={styles.bannerLimited}>
              <Text style={styles.bannerLimitedText}>
                Device media discovery is not connected in this build. Import a
                canonical JSON collection using the picker below.
              </Text>
            </View>
          ) : accessState === "denied" ? (
            <View style={styles.bannerDenied}>
              <MaterialIcons name="lock" size={18} color="#EF4444" />
              <Text style={styles.bannerDeniedText}>
                Media access not granted. You can still select individual files
                via document picker.
              </Text>
            </View>
          ) : accessState === "limited" ? (
            <View style={styles.bannerLimited}>
              <MaterialIcons name="info" size={18} color="#F6C75B" />
              <Text style={styles.bannerLimitedText}>
                Limited photo access granted. Only selected media is visible.
              </Text>
            </View>
          ) : null}

          <Pressable onPress={onPickDocument} style={styles.pickBtn}>
            <MaterialIcons name="upload-file" size={18} color="#080D18" />
            <Text style={styles.pickBtnText}>Pick canonical JSON</Text>
          </Pressable>

          <FlatList
            data={items}
            keyExtractor={(item) => item.discoveryHandle}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <View style={styles.itemRow}>
                <MaterialIcons
                  name="insert-drive-file"
                  size={20}
                  color="#50D4FF"
                />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                  <Text style={styles.itemSub}>
                    Source-only preview · {item.mimeType}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {accessState === "denied"
                    ? "Media access not granted. Use the file picker above."
                    : "No local files discovered yet."}
                </Text>
              </View>
            }
          />
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
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    color: "#F4F7FB",
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: "#A8B4C8",
    fontSize: 12,
    marginTop: 2,
  },
  closeIcon: {
    padding: 4,
  },
  bannerDenied: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EF44441F",
    borderColor: "#EF444450",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  bannerDeniedText: {
    color: "#EF4444",
    fontSize: 11,
    flex: 1,
  },
  bannerLimited: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F6C75B1F",
    borderColor: "#F6C75B50",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  bannerLimitedText: {
    color: "#F6C75B",
    fontSize: 11,
    flex: 1,
  },
  pickBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#50D4FF",
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 14,
  },
  pickBtnText: {
    color: "#080D18",
    fontSize: 12,
    fontWeight: "800",
  },
  list: {
    paddingVertical: 14,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#17233B",
    borderColor: "#263554",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginVertical: 4,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    color: "#F4F7FB",
    fontSize: 12,
    fontWeight: "700",
  },
  itemSub: {
    color: "#A8B4C8",
    fontSize: 10,
  },
  empty: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    color: "#A8B4C8",
    fontSize: 12,
    textAlign: "center",
  },
});
