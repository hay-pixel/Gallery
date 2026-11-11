import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCatalogue } from "../../features/catalogue/catalogue-provider";
import { SourcesScreen } from "../../features/sources/sources-screen";
import { createCanonicalImportPicker } from "../../lib/catalogue/native-import-picker";
import { pickCanonicalImport } from "../../lib/catalogue/pick-import";
import { getGallerySessionToken } from "../../lib/gallery-session";
import { trpc } from "../../lib/trpc";

export default function SourcesRoute() {
  const { snapshot, importCanonicalBatch } = useCatalogue();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const beginConnect = trpc.googleDrive.beginConnect.useMutation();

  const handleTriggerPicker = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const batch = await pickCanonicalImport(createCanonicalImportPicker());
      if (!batch) return;
      await importCanonicalBatch(batch);
      setMessage(
        `Imported ${batch.assets.length} asset record${batch.assets.length === 1 ? "" : "s"}. Your library is saved on this device.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to import the selected file.",
      );
    } finally {
      setBusy(false);
    }
  };

  const connectDrive = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const token = await getGallerySessionToken();
      if (!token)
        throw new Error(
          "Cannot reach Gallery. Check your backend connection and try again.",
        );
      const configured = process.env.EXPO_PUBLIC_GALLERY_RETURN_ORIGIN?.replace(
        /\/$/,
        "",
      );
      const returnUri =
        Platform.OS === "web"
          ? `${configured || window.location.origin}/oauth/drive`
          : Linking.createURL("/oauth/drive", {
              scheme: "ollamabinsaden-gallery",
            });
      const { authorizationUrl } = await beginConnect.mutateAsync({
        returnUri,
      });
      const result = await WebBrowser.openAuthSessionAsync(
        authorizationUrl,
        returnUri,
      );
      if (result.type === "success") {
        const status = new URL(result.url).searchParams.get("drive");
        if (status === "connected")
          setMessage(
            "Google Drive connected. Your originals remain read-only.",
          );
        else if (status === "cancelled")
          setMessage("Drive connection cancelled.");
        else
          setError(
            "Drive connection could not be completed. Please try again.",
          );
      } else setMessage("Drive connection cancelled.");
    } catch {
      setError(
        "Could not connect to Google Drive. Check the Gallery backend and its Drive configuration, then try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <View style={styles.root}>
        <SourcesScreen
          snapshot={snapshot}
          busy={busy}
          message={message}
          error={error}
          onTriggerPicker={() => {
            void handleTriggerPicker();
          }}
          onConnectDrive={() => {
            void connectDrive();
          }}
        />
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#080D18" },
  root: { flex: 1, backgroundColor: "#080D18" },
});
