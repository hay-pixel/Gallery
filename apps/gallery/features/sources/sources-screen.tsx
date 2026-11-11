import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  ActionButton,
  IconButton,
  Notice,
  ScreenHeading,
} from "../../components/gallery/primitives";
import { galleryTheme as t } from "../../constants/gallery-theme";
import { hasDemoAssets } from "../../lib/catalogue/demo";
import type { GalleryCatalogueSnapshotV1 } from "../../lib/catalogue/types";

export type DriveAccount = {
  id: number;
  displayName: string;
  email: string | null;
};
export type SourcesScreenProps = {
  snapshot: GalleryCatalogueSnapshotV1;
  busy?: boolean;
  message?: string | null;
  error?: string | null;
  accounts?: DriveAccount[];
  loadingAccounts?: boolean;
  accountsError?: boolean;
  onImportSuccess?: () => void;
  onConnectDrive?: () => void;
  onTriggerPicker?: () => void;
  onBrowseDrive?: (id: number) => void;
  onRefresh?: () => void;
};
export function SourcesScreen({
  snapshot,
  busy = false,
  message,
  error,
  accounts = [],
  loadingAccounts,
  accountsError,
  onConnectDrive,
  onTriggerPicker,
  onBrowseDrive,
  onRefresh,
}: SourcesScreenProps) {
  const importedCount = snapshot.canonical_assets.filter(
    (asset) => !asset.storage_locator.startsWith("fixture://"),
  ).length;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={s.page}
    >
      <ScreenHeading
        title="Sources"
        subtitle="Bring your files together. Leave originals where they are."
        action={
          onRefresh ? (
            <IconButton
              label="Refresh sources"
              icon="refresh"
              onPress={onRefresh}
            />
          ) : undefined
        }
      />
      {error ? <Notice text={error} error /> : null}
      {message ? <Notice text={message} /> : null}
      <View style={s.connectCard}>
        <View style={s.driveIcon}>
          <MaterialIcons name="add-to-drive" size={30} color={t.accent} />
        </View>
        <Text style={s.cardTitle}>Your Drive, in one place.</Text>
        <Text style={s.body}>
          Connect a Google account to browse photos, documents, and everything
          in between.
        </Text>
        <ActionButton
          label={busy ? "Please wait…" : "Connect Google Drive"}
          icon="add"
          onPress={onConnectDrive}
          disabled={busy}
        />
        <View style={s.assurance}>
          <MaterialIcons name="lock-outline" size={14} color={t.muted} />
          <Text style={s.caption}>
            Read-only access. Originals stay untouched.
          </Text>
        </View>
      </View>
      <View style={s.sectionHeader}>
        <Text role="heading" aria-level={2} style={s.sectionTitle}>
          Connected accounts
        </Text>
        <Text style={s.caption}>{accountsError ? "—" : accounts.length}</Text>
      </View>
      {loadingAccounts ? (
        <Text style={s.body}>Checking your connections…</Text>
      ) : null}
      {accountsError ? (
        <Notice text="Couldn't load your connections. Your saved library is still available. Check your backend connection and refresh." />
      ) : null}
      {accounts.map((account) => (
        <Pressable
          key={account.id}
          accessibilityRole="button"
          accessibilityLabel={`Browse ${account.displayName}`}
          onPress={() => onBrowseDrive?.(account.id)}
          style={({ pressed }) => [s.account, pressed && { opacity: 0.65 }]}
        >
          <View style={s.accountIcon}>
            <MaterialIcons name="cloud-done" size={23} color={t.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={s.accountName}>
              {account.displayName}
            </Text>
            <Text numberOfLines={1} style={s.caption}>
              {account.email || "Google Drive"} · read-only
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={t.muted} />
        </Pressable>
      ))}
      {!accounts.length && !loadingAccounts && !accountsError ? (
        <View style={s.noAccounts}>
          <Text style={s.body}>No accounts connected yet.</Text>
          <Text style={s.caption}>
            You can connect more than one Google account.
          </Text>
        </View>
      ) : null}
      <Text
        role="heading"
        aria-level={2}
        style={[s.sectionTitle, { marginTop: 30, marginBottom: 14 }]}
      >
        On this device
      </Text>
      <View style={s.saved}>
        <MaterialIcons name="folder-open" size={25} color={t.muted} />
        <View style={{ flex: 1 }}>
          <Text style={s.accountName}>Saved library</Text>
          <Text style={s.caption}>
            {importedCount} imported {importedCount === 1 ? "file" : "files"}
            {hasDemoAssets(snapshot) ? " · includes demo data" : ""}
          </Text>
        </View>
      </View>
      <View style={s.importCard}>
        <Text style={s.accountName}>Already have a collection?</Text>
        <Text style={s.body}>
          Import a Gallery collection (.json) with file records and previews.
          Your saved notes and review decisions are kept.
        </Text>
        <ActionButton
          label="Import collection"
          secondary
          icon="file-upload"
          onPress={onTriggerPicker}
          disabled={busy}
        />
      </View>
      <Text style={s.footer}>
        Files stay under your control. Removing a connection never changes an
        original.
      </Text>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  page: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  connectCard: {
    padding: 22,
    backgroundColor: t.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: t.border,
    gap: 18,
  },
  driveIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "#223C37",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    color: t.text,
    fontSize: 25,
    fontWeight: "500",
    letterSpacing: -0.7,
  },
  body: { color: t.muted, fontSize: 14, lineHeight: 22 },
  caption: { color: t.muted, fontSize: 12, lineHeight: 19 },
  assurance: {
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 30,
    marginBottom: 14,
  },
  sectionTitle: { color: t.text, fontSize: 16, fontWeight: "600" },
  account: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    minHeight: 82,
    borderBottomWidth: 1,
    borderColor: t.border,
    paddingVertical: 12,
  },
  accountIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: t.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  accountName: {
    color: t.text,
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 4,
  },
  noAccounts: { paddingVertical: 6, gap: 5 },
  saved: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    marginBottom: 18,
  },
  importCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: t.border,
    gap: 12,
  },
  footer: { color: t.muted, fontSize: 12, lineHeight: 20, marginTop: 24 },
});
