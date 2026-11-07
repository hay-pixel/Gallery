import React from "react";
import { StyleSheet, Text, View } from "react-native";

export type CapabilityBannerStatus =
  | "ready"
  | "unavailable"
  | "stale"
  | "partial"
  | "failed"
  | "unsupported"
  | "incompatible";

export type CapabilityBannerProps = {
  serviceName: string;
  status: CapabilityBannerStatus;
  detail?: string;
};

const statusColors: Record<CapabilityBannerStatus, { bg: string; text: string; border: string }> = {
  ready: { bg: "#56D49A1A", text: "#56D49A", border: "#56D49A4D" },
  unavailable: { bg: "#F6C75B1A", text: "#F6C75B", border: "#F6C75B4D" },
  stale: { bg: "#9A7DFF1A", text: "#9A7DFF", border: "#9A7DFF4D" },
  partial: { bg: "#50D4FF1A", text: "#50D4FF", border: "#50D4FF4D" },
  failed: { bg: "#EF44441A", text: "#EF4444", border: "#EF44444D" },
  unsupported: { bg: "#A8B4C81A", text: "#A8B4C8", border: "#A8B4C84D" },
  incompatible: { bg: "#EF44441A", text: "#EF4444", border: "#EF44444D" },
};

export function CapabilityBanner({ serviceName, status, detail }: CapabilityBannerProps) {
  if (status === "ready" && !detail) {
    return null;
  }

  const theme = statusColors[status] ?? statusColors.unavailable;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.bg, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.title, { color: theme.text }]}>
        {serviceName} {status}
      </Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginVertical: 6,
    gap: 3,
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  detail: {
    fontSize: 11,
    color: "#A8B4C8",
    lineHeight: 15,
  },
});
