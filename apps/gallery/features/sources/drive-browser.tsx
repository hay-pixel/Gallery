import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React, { useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActionButton,
  IconButton,
  LoadingState,
  Notice,
} from "../../components/gallery/primitives";
import { galleryTheme as t } from "../../constants/gallery-theme";
import { getApiBaseUrl } from "../../constants/oauth";
export type DrivePreviewFile = {
  id: string;
  name: string;
  mimeType: string;
  sourceId: number;
  hasThumbnail: boolean;
  mediaGrant: string;
  thumbnailGrant?: string;
  sourceName: string;
};
export function DriveBrowser({
  visible,
  title,
  files,
  loading,
  error,
  onClose,
  onRetry,
}: {
  visible: boolean;
  title: string;
  files: DrivePreviewFile[];
  loading: boolean;
  error: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  const [previewError, setPreviewError] = useState(false);
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<DrivePreviewFile | null>(null);
  if (!visible) return null;
  const mediaUri = (file: DrivePreviewFile, thumbnail: boolean) =>
    `${getApiBaseUrl()}/api/google-drive/${thumbnail ? "thumbnail" : "media"}/${file.sourceId}/${encodeURIComponent(file.id)}?grant=${encodeURIComponent(thumbnail ? file.thumbnailGrant! : file.mediaGrant)}`;
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.background }}>
        <View
          style={[
            s.page,
            {
              paddingTop: Math.max(insets.top, 16),
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={s.heading}>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={s.title}>
                {selected ? selected.name : title}
              </Text>
              <Text style={s.caption}>
                Read-only preview · files stay in Drive
              </Text>
            </View>
            <IconButton
              label={selected ? "Back to Drive files" : "Close Drive browser"}
              icon={selected ? "arrow-back" : "close"}
              onPress={selected ? () => setSelected(null) : onClose}
            />
          </View>
          {loading ? (
            <LoadingState label="Loading Drive files" />
          ) : error ? (
            <View>
              <Notice
                error
                text="Couldn't load this Drive. Its authorization may have expired. Refresh or reconnect the account."
              />
              <ActionButton label="Try again" onPress={onRetry} />
            </View>
          ) : selected ? (
            <View style={s.viewer}>
              {selected.mimeType.startsWith("image/") && !previewError ? (
                <Image
                  onError={() => setPreviewError(true)}
                  accessibilityLabel={selected.name}
                  source={{ uri: mediaUri(selected, false) }}
                  resizeMode="contain"
                  style={{ width: "100%", flex: 1, minHeight: 220 }}
                />
              ) : (
                <View style={s.unavailable}>
                  <MaterialIcons name="description" size={48} color={t.muted} />
                  <Text style={s.caption}>
                    {previewError
                      ? "This preview could not be loaded. Refresh the Drive to try again."
                      : "Preview is not available for this file type."}
                  </Text>
                </View>
              )}
              <Text style={s.caption}>{selected.mimeType}</Text>
              {previewError ? (
                <ActionButton
                  label="Refresh Drive"
                  onPress={() => {
                    setSelected(null);
                    setPreviewError(false);
                    onRetry();
                  }}
                />
              ) : null}
            </View>
          ) : (
            <FlatList
              data={files}
              keyExtractor={(file) => file.id}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={
                <Text style={[s.caption, { marginBottom: 12 }]}>
                  {files.length} files · Drive previews are separate from your
                  saved library.
                </Text>
              }
              ListEmptyComponent={
                <Text style={s.caption}>
                  No files were returned by this account.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Preview ${item.name}`}
                  onPress={() => {
                    setPreviewError(false);
                    setSelected(item);
                  }}
                  style={s.file}
                >
                  <View style={s.thumbnail}>
                    {item.hasThumbnail && item.thumbnailGrant ? (
                      <Image
                        source={{ uri: mediaUri(item, true) }}
                        style={{ width: 54, height: 54 }}
                      />
                    ) : (
                      <MaterialIcons
                        name={
                          item.mimeType.startsWith("image/")
                            ? "image"
                            : "description"
                        }
                        size={24}
                        color={t.muted}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.filename} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={s.caption}>{item.mimeType}</Text>
                  </View>
                  <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={t.muted}
                  />
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: t.background,
    paddingHorizontal: 20,
    width: "100%",
    maxWidth: 1000,
    alignSelf: "center",
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 24,
    paddingTop: 8,
  },
  title: { color: t.text, fontSize: 23, fontWeight: "600", flexShrink: 1 },
  caption: { color: t.muted, fontSize: 13, lineHeight: 20, marginTop: 6 },
  file: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: t.border,
    paddingVertical: 12,
  },
  thumbnail: {
    width: 54,
    height: 54,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: t.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  filename: { color: t.text, fontSize: 15, lineHeight: 21 },
  viewer: { flex: 1, gap: 16 },
  unavailable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
});
