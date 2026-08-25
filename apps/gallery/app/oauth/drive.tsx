import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";

export default function GoogleDriveReturnScreen() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    const timer = setTimeout(() => router.replace("/(tabs)"), 250);
    return () => clearTimeout(timer);
  }, []);

  return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#080D18" }}><ActivityIndicator color="#50D4FF" /><Text style={{ color: "#F4F7FB", fontSize: 14, fontWeight: "700" }}>Returning to PixelDrive…</Text></View>;
}
