import AsyncStorage from "@react-native-async-storage/async-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useColorScheme,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useBackend } from "@/lib/backend-provider";
import {
  getGallerySessionToken,
  setGallerySessionToken,
} from "@/lib/gallery-session";
import { trpc } from "@/lib/trpc";
import {
  cacheDriveFiles,
  mergeDriveAvailability,
  safeExternalUrl,
} from "@/lib/client-runtime";
import { formatBytes } from "@/lib/pixeldrive";
import {
  entryKey,
  filterAndSort,
  mergeFolderScan,
  parseTags,
  type LibraryEntry,
  type PhoneFolder,
  type SortOrder,
} from "@/lib/local-library";
import {
  loadPhoneIndexState,
  savePhoneIndexState,
  openPhoneFile,
  phoneIndexAvailable,
  pickPhoneFolder,
  releasePhoneFolder,
  scanPhoneFolder,
} from "@/lib/phone-index";
import {
  Button,
  Label,
  Section,
  PaletteContext,
  lightPalette,
  darkPalette,
  layout,
} from "@/components/gallery-ui";

type Tab = "Library" | "Search" | "Settings";
type Appearance = "Light" | "Dark" | "System";
type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  description?: string;
  webViewLink?: string;
  mediaGrant?: string;
  thumbnailGrant?: string;
  sourceId: number;
  sourceName: string;
};
const PREFS_KEY = "gallery.preferences.v1";
const nav = [
  { name: "Library" as const, icon: "folder-open" as const },
  { name: "Search" as const, icon: "search" as const },
  { name: "Settings" as const, icon: "tune" as const },
];

export default function GalleryScreen() {
  const backend = useBackend();
  const insets = useSafeAreaInsets();
  const system = useColorScheme();
  const [tab, setTab] = useState<Tab>("Library");
  const [appearance, setAppearance] = useState<Appearance>("Light");
  const [folders, setFolders] = useState<PhoneFolder[]>([]);
  const [phoneFiles, setPhoneFiles] = useState<LibraryEntry[]>([]);
  const [tags, setTags] = useState<Record<string, string[]>>({});
  const [cachedDrive, setCachedDrive] = useState<DriveFile[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const pickingRef = useRef(false);
  const foldersRef = useRef(folders);
  foldersRef.current = folders;
  const [message, setMessage] = useState("");
  const [session, setSession] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("All");
  const [sort, setSort] = useState<SortOrder>("Name");
  const [tagFilter, setTagFilter] = useState("");
  const [selected, setSelected] = useState<LibraryEntry | null>(null);
  const [tagText, setTagText] = useState("");
  const [model, setModel] = useState("");
  const dark =
    appearance === "Dark" || (appearance === "System" && system === "dark");
  const p = dark ? darkPalette : lightPalette;
  const driveKey = `gallery.drive-cache.v4:${backend.url}`;
  const { mutateAsync: createSession } = trpc.session.create.useMutation();
  const sourcesQuery = trpc.googleDrive.list.useQuery(undefined, {
    enabled: !!session,
  });
  const driveQuery = trpc.googleDrive.files.useQuery(undefined, {
    enabled: !!session,
    staleTime: 60000,
    refetchInterval: 240000,
  });
  const modelsQuery = trpc.hosted.models.useQuery(undefined, {
    enabled: !!session,
    staleTime: 60000,
  });
  const connectMutation = trpc.googleDrive.beginConnect.useMutation();
  const approvedModels = modelsQuery.data ?? [];
  const selectedModel = approvedModels.find((m) => m.id === model);

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadPhoneIndexState(),
      AsyncStorage.getItem(PREFS_KEY),
      AsyncStorage.getItem(driveKey),
    ])
      .then(([local, prefs, drive]) => {
        if (!active) return;
        if (local) {
          const saved = JSON.parse(local);
          if (saved.version === 1) {
            setFolders(Array.isArray(saved.folders) ? saved.folders : []);
            setPhoneFiles(Array.isArray(saved.files) ? saved.files : []);
            setTags(saved.tags ?? {});
          }
        }
        if (prefs) {
          const saved = JSON.parse(prefs);
          if (["Light", "Dark", "System"].includes(saved.appearance))
            setAppearance(saved.appearance);
          setModel(typeof saved.model === "string" ? saved.model : "");
        }
        if (drive) {
          const saved = JSON.parse(drive);
          setCachedDrive(Array.isArray(saved) ? saved : []);
        }
      })
      .catch(() => setMessage("Saved settings could not be read."))
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [driveKey]);
  useEffect(() => {
    if (ready)
      void savePhoneIndexState(
        JSON.stringify({ version: 1, folders, files: phoneFiles, tags }),
      ).catch(() => setMessage("The phone index could not be saved."));
  }, [folders, phoneFiles, tags, ready]);
  useEffect(() => {
    if (ready)
      void AsyncStorage.setItem(
        PREFS_KEY,
        JSON.stringify({ appearance, model }),
      ).catch(() => setMessage("Preferences could not be saved."));
  }, [appearance, model, ready]);
  useEffect(() => {
    if (!backend.url) return;
    let active = true;
    void getGallerySessionToken()
      .then(async (token) => {
        if (!token) {
          const created = await createSession();
          token = created.token;
          await setGallerySessionToken(token);
        }
        if (active) setSession(token);
      })
      .catch(() => {
        if (active)
          setMessage(
            "Hosted services are temporarily unavailable. Phone files still work.",
          );
      });
    return () => {
      active = false;
    };
  }, [backend.url, createSession, attempt]);
  const groups = useMemo(() => driveQuery.data ?? [], [driveQuery.data]);
  const liveDrive = useMemo(
    () =>
      groups.flatMap((group) =>
        group.files.map((file) => ({
          ...file,
          sourceId: group.source.id,
          sourceName: group.source.displayName,
        })),
      ),
    [groups],
  );
  const driveFiles = useMemo(
    () =>
      driveQuery.isSuccess
        ? mergeDriveAvailability(
            liveDrive,
            cachedDrive,
            groups
              .filter((g) => g.status === "unavailable")
              .map((g) => g.source.id),
          )
        : cachedDrive,
    [driveQuery.isSuccess, liveDrive, cachedDrive, groups],
  );
  useEffect(() => {
    if (!driveQuery.isSuccess) return;
    setCachedDrive((previous) => {
      const cached = cacheDriveFiles(
        mergeDriveAvailability(
          liveDrive,
          previous,
          groups
            .filter((g) => g.status === "unavailable")
            .map((g) => g.source.id),
        ),
      );
      if (JSON.stringify(previous) === JSON.stringify(cached)) return previous;
      void AsyncStorage.setItem(driveKey, JSON.stringify(cached)).catch(() =>
        setMessage("Drive metadata could not be saved."),
      );
      return cached;
    });
  }, [driveQuery.isSuccess, liveDrive, groups, driveKey]);
  const entries = useMemo<LibraryEntry[]>(
    () => [
      ...phoneFiles,
      ...driveFiles.map((file) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size ? Number(file.size) : undefined,
        modifiedTime: file.modifiedTime
          ? Date.parse(file.modifiedTime)
          : undefined,
        sourceId: `drive:${file.sourceId}`,
        sourceName: file.sourceName,
        origin: "drive" as const,
        description: file.description,
        webViewLink: file.webViewLink,
        driveSourceId: file.sourceId,
        thumbnailGrant: file.thumbnailGrant,
        mediaGrant: file.mediaGrant,
      })),
    ],
    [phoneFiles, driveFiles],
  );
  const visible = useMemo(
    () => filterAndSort(entries, query, source, sort, tags, tagFilter),
    [entries, query, source, sort, tags, tagFilter],
  );
  const allTags = useMemo(
    () => [...new Set(entries.flatMap((e) => tags[entryKey(e)] ?? []))].sort(),
    [entries, tags],
  );

  const scan = useCallback(async (targets: PhoneFolder[]) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    try {
      for (const folder of targets) {
        try {
          const result = await scanPhoneFolder(folder);
          setPhoneFiles((previous) =>
            mergeFolderScan(
              previous,
              folder.uri,
              result.files,
              result.complete,
            ),
          );
          setFolders((previous) =>
            previous.map((f) =>
              f.uri === folder.uri
                ? {
                    ...f,
                    lastScan: new Date().toISOString(),
                    status: result.complete
                      ? "Up to date"
                      : `Partial scan · ${result.errors ? "some folders could not be read" : "20,000-item limit reached"}`,
                  }
                : f,
            ),
          );
        } catch {
          setFolders((previous) =>
            previous.map((f) =>
              f.uri === folder.uri
                ? { ...f, status: "Access lost · add this folder again" }
                : f,
            ),
          );
          setMessage(
            "A folder needs permission again. Its cached index is still available.",
          );
        }
      }
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    if (!ready || !phoneIndexAvailable) return;
    void scan(foldersRef.current);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active" && !pickingRef.current)
        void scan(foldersRef.current);
    });
    return () => listener.remove();
  }, [ready, scan]);
  const addFolder = async () => {
    if (busyRef.current) return;
    pickingRef.current = true;
    try {
      const folder = await pickPhoneFolder();
      if (!folder) return;
      setFolders((previous) =>
        previous.some((f) => f.uri === folder.uri)
          ? previous
          : [...previous, folder],
      );
      await scan([folder]);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The folder could not be added.",
      );
    } finally {
      pickingRef.current = false;
    }
  };
  const removeFolder = async (folder: PhoneFolder) => {
    if (busyRef.current) return;
    try {
      await releasePhoneFolder(folder);
      setFolders((previous) => previous.filter((f) => f.uri !== folder.uri));
      setPhoneFiles((previous) =>
        previous.filter((f) => f.sourceId !== folder.uri),
      );
    } catch {
      setMessage("The folder could not be removed. Try again.");
    }
  };
  const retry = () => {
    setMessage("");
    setAttempt((value) => value + 1);
    if (session) {
      void sourcesQuery.refetch();
      void driveQuery.refetch();
      void modelsQuery.refetch();
    }
  };
  const connect = async () => {
    if (!session) {
      setMessage(
        backend.url
          ? "Hosted services are not connected yet. Tap Retry."
          : "Google Drive will be available when the hosted service is configured.",
      );
      return;
    }
    try {
      const returnUri =
        Platform.OS === "web"
          ? `${process.env.EXPO_PUBLIC_GALLERY_RETURN_ORIGIN || window.location.origin}/oauth/drive`
          : Linking.createURL("/oauth/drive", {
              scheme: "ollamabinsaden-gallery",
            });
      const result = await connectMutation.mutateAsync({ returnUri });
      const auth = await WebBrowser.openAuthSessionAsync(
        result.authorizationUrl,
        returnUri,
      );
      if (auth.type === "success") {
        void sourcesQuery.refetch();
        void driveQuery.refetch();
      }
    } catch {
      setMessage("Google sign-in could not finish. Please try again.");
    }
  };
  const open = async () => {
    if (!selected) return;
    try {
      if (selected.origin === "phone") await openPhoneFile(selected);
      else {
        const url = safeExternalUrl(selected.webViewLink);
        if (url) await Linking.openURL(url);
        else setMessage("This file has no available original link.");
      }
    } catch {
      setMessage(
        "The file could not be opened. Check folder access or install an app for this file type.",
      );
    }
  };
  const thumbnail = (entry: LibraryEntry) =>
    entry.origin === "phone" && entry.mimeType.startsWith("image/")
      ? entry.uri
      : entry.thumbnailGrant
        ? `${backend.url}/api/google-drive/thumbnail/${entry.driveSourceId}/${encodeURIComponent(entry.id)}?grant=${encodeURIComponent(entry.thumbnailGrant)}`
        : undefined;
  const error =
    message ||
    (driveQuery.isError
      ? "Google Drive is offline. Saved metadata is still available."
      : "");
  const actions = (
    <View style={{ gap: 10, alignSelf: "stretch" }}>
      <Button
        title="Add phone folder"
        icon="create-new-folder"
        primary
        disabled={busy}
        onPress={() => void addFolder()}
      />
      <Button
        title="Connect Google Drive"
        disabled={connectMutation.isPending}
        onPress={() => void connect()}
      />
    </View>
  );
  const chips = (
    values: string[],
    value: string,
    onSelect: (value: string) => void,
  ) => (
    <ScrollView
      horizontal
      style={{ flexGrow: 0, flexShrink: 0 }}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 7, paddingVertical: 2 }}
    >
      {values.map((item) => (
        <Pressable
          key={item}
          accessibilityRole="button"
          accessibilityState={{ selected: value === item }}
          onPress={() => onSelect(item)}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 13,
            borderRadius: 10,
            backgroundColor: value === item ? p.tint : p.surface,
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: value === item ? "600" : "400",
              color: value === item ? p.accent : p.muted,
            }}
          >
            {item}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <PaletteContext.Provider value={p}>
      <SafeAreaView
        style={{ flex: 1, backgroundColor: p.bg }}
        edges={["top", "left", "right"]}
      >
        <StatusBar style={dark ? "light" : "dark"} />
        {!ready ? (
          <View style={{ flex: 1, justifyContent: "center" }}>
            <ActivityIndicator color={p.accent} />
          </View>
        ) : (
          <>
            <View
              style={{
                paddingHorizontal: 22,
                paddingTop: 15,
                paddingBottom: 14,
                gap: 3,
              }}
            >
              <Text
                style={{
                  color: p.text,
                  fontSize: 32,
                  fontWeight: "600",
                  letterSpacing: -1,
                }}
              >
                {tab === "Library" ? "Gallery" : tab}
              </Text>
              {tab === "Library" && <Label muted>Your files, together.</Label>}
            </View>
            {!!error && (
              <View
                style={{
                  backgroundColor: p.tint,
                  padding: 14,
                  marginHorizontal: 22,
                  borderRadius: 12,
                  marginBottom: 12,
                  gap: 10,
                }}
              >
                <Label>{error}</Label>
                <Button title="Dismiss" onPress={() => setMessage("")} />
              </View>
            )}
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={[layout.page, { flexGrow: 1 }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {tab === "Settings" ? (
                <>
                  <Section title="Appearance">
                    {chips(["Light", "Dark", "System"], appearance, (v) =>
                      setAppearance(v as Appearance),
                    )}
                  </Section>
                  <Section title="Phone folders">
                    <Label muted>
                      Only an index is saved. Files stay on your phone and are
                      never uploaded by a scan.
                    </Label>
                    <Button
                      title="Add phone folder"
                      primary
                      disabled={busy}
                      onPress={() => void addFolder()}
                    />
                    {!phoneIndexAvailable && (
                      <Label muted>
                        Folder access is available in the Android app.
                      </Label>
                    )}
                    {folders.map((folder) => (
                      <View
                        key={folder.uri}
                        style={{
                          borderBottomWidth: 1,
                          borderColor: p.line,
                          paddingVertical: 12,
                          gap: 8,
                        }}
                      >
                        <Label>{folder.name}</Label>
                        <Label muted>
                          {folder.status ?? "Ready to scan"}
                          {folder.lastScan
                            ? ` · ${new Date(folder.lastScan).toLocaleString()}`
                            : ""}
                        </Label>
                        <View style={layout.wrap}>
                          <Button
                            title="Rescan"
                            disabled={busy}
                            onPress={() => void scan([folder])}
                          />
                          <Button
                            title="Remove folder"
                            disabled={busy}
                            onPress={() => void removeFolder(folder)}
                          />
                        </View>
                      </View>
                    ))}
                    <Label muted>
                      Folders refresh when Gallery opens or returns to the
                      foreground. Android restricts access to some storage
                      locations.
                    </Label>
                  </Section>
                  <Section title="Google Drive">
                    <Label muted>
                      Connect your Google account for read-only browsing.
                    </Label>
                    {(sourcesQuery.data ?? []).map((s) => (
                      <View key={s.id} style={{ gap: 3 }}>
                        <Label>{s.displayName}</Label>
                        <Label muted>
                          {s.email || "Google account"} ·{" "}
                          {groups.find((g) => g.source.id === s.id)?.status ===
                          "available"
                            ? "Connected"
                            : "Reconnect needed"}
                        </Label>
                      </View>
                    ))}
                    <Button
                      title="Connect Google Drive"
                      disabled={connectMutation.isPending}
                      onPress={() => void connect()}
                    />
                  </Section>
                  <Section title="Hosted models">
                    <Label muted>
                      We provide the server, runtime and customised models.
                      Choose an available model below.
                    </Label>
                    {approvedModels.length ? (
                      approvedModels.map((m) => (
                        <Pressable
                          key={m.id}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: model === m.id }}
                          onPress={() => setModel(m.id)}
                          style={{
                            padding: 16,
                            borderRadius: 12,
                            backgroundColor:
                              model === m.id ? p.tint : p.surface,
                            gap: 4,
                          }}
                        >
                          <Label>
                            {m.name}
                            {model === m.id ? " · Selected" : ""}
                          </Label>
                          <Label muted>{m.description}</Label>
                        </Pressable>
                      ))
                    ) : (
                      <Label muted>No models available yet.</Label>
                    )}
                    {model && !selectedModel && (
                      <Label muted>
                        Your saved model is currently unavailable.
                      </Label>
                    )}
                    <Label muted>
                      Phone file content is not sent to hosted AI. AI tagging
                      and answers will become available after the hosted
                      integration is connected.
                    </Label>
                  </Section>
                  <Section title="Hosted service">
                    <Label muted>
                      {backend.url
                        ? session
                          ? "Connected to Gallery hosting."
                          : "Gallery hosting is temporarily unavailable."
                        : "Hosted services are being prepared."}
                    </Label>
                    <Button title="Retry" onPress={retry} />
                  </Section>
                  <Section title="Companion apps">
                    <View style={layout.wrap}>
                      {(["assist", "extract"] as const).map((name) => (
                        <Button
                          key={name}
                          title={
                            name === "assist" ? "Open Assist" : "Open Extract"
                          }
                          onPress={() =>
                            void Linking.openURL(
                              `ollamabinsaden-${name}://`,
                            ).catch(() =>
                              setMessage(
                                "The companion app could not be opened.",
                              ),
                            )
                          }
                        />
                      ))}
                    </View>
                  </Section>
                  <Label muted>
                    Gallery 1.1.0 · Files remain in their original locations.
                  </Label>
                </>
              ) : (
                <>
                  {tab === "Search" && (
                    <TextInput
                      accessibilityLabel="Search files and tags"
                      placeholder="Search files and tags"
                      placeholderTextColor={p.muted}
                      value={query}
                      onChangeText={setQuery}
                      style={[
                        layout.input,
                        {
                          borderColor: p.line,
                          color: p.text,
                          backgroundColor: p.surface,
                        },
                      ]}
                      autoCapitalize="none"
                    />
                  )}
                  {entries.length > 0 && (
                    <>
                      <View style={layout.row}>
                        <View style={{ flex: 1 }}>
                          {chips(
                            ["All", "Phone", "Drive"],
                            source === "phone"
                              ? "Phone"
                              : source === "drive"
                                ? "Drive"
                                : "All",
                            (v) => setSource(v === "All" ? v : v.toLowerCase()),
                          )}
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Refresh sources"
                          disabled={busy}
                          onPress={() => {
                            void scan(folders);
                            if (session) void driveQuery.refetch();
                          }}
                          style={{ padding: 11 }}
                        >
                          {busy ? (
                            <ActivityIndicator color={p.accent} />
                          ) : (
                            <MaterialIcons
                              name="refresh"
                              size={23}
                              color={p.accent}
                            />
                          )}
                        </Pressable>
                      </View>
                      <Label muted>Sort by</Label>
                      {chips(["Name", "Date", "Size", "Type"], sort, (v) =>
                        setSort(v as SortOrder),
                      )}
                      {allTags.length > 0 && (
                        <>
                          {chips(
                            ["All tags", ...allTags],
                            tagFilter || "All tags",
                            (v) => setTagFilter(v === "All tags" ? "" : v),
                          )}
                        </>
                      )}
                      <Label muted>
                        {visible.length}{" "}
                        {visible.length === 1 ? "file" : "files"}
                        {busy ? " · Scanning…" : ""}
                      </Label>
                    </>
                  )}
                  {entries.length === 0 ? (
                    <View style={layout.center}>
                      <MaterialIcons
                        name="folder-open"
                        size={44}
                        color={p.accent}
                      />
                      <Label large>Your library starts here</Label>
                      <Label muted>
                        Add a phone folder or connect Google Drive. Search, sort
                        and tag your files in one place.
                      </Label>
                      {actions}
                      {busy && <ActivityIndicator color={p.accent} />}
                    </View>
                  ) : visible.length === 0 ? (
                    <View style={layout.center}>
                      <Label large>No matching files</Label>
                      <Label muted>
                        Try another search or clear your filters.
                      </Label>
                      <Button
                        title="Clear filters"
                        onPress={() => {
                          setQuery("");
                          setSource("All");
                          setTagFilter("");
                        }}
                      />
                    </View>
                  ) : (
                    visible.slice(0, 250).map((entry) => (
                      <Pressable
                        key={entryKey(entry)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open details for ${entry.name}`}
                        onPress={() => {
                          setSelected(entry);
                          setTagText((tags[entryKey(entry)] ?? []).join(", "));
                        }}
                        style={({ pressed }) => [
                          {
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 13,
                            paddingVertical: 13,
                            borderBottomWidth: 1,
                            borderColor: p.line,
                            opacity: pressed ? 0.65 : 1,
                          },
                        ]}
                      >
                        {thumbnail(entry) ? (
                          <Image
                            source={{ uri: thumbnail(entry) }}
                            style={{ width: 48, height: 48, borderRadius: 8 }}
                            contentFit="cover"
                          />
                        ) : (
                          <View
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: 8,
                              backgroundColor: p.surface,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <MaterialIcons
                              name={
                                entry.mimeType.startsWith("image/")
                                  ? "image"
                                  : entry.mimeType.startsWith("video/")
                                    ? "videocam"
                                    : "description"
                              }
                              size={23}
                              color={p.accent}
                            />
                          </View>
                        )}
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text
                            numberOfLines={2}
                            style={{
                              color: p.text,
                              fontSize: 15,
                              fontWeight: "500",
                              lineHeight: 21,
                            }}
                          >
                            {entry.name}
                          </Text>
                          <Text
                            numberOfLines={1}
                            style={{ color: p.muted, fontSize: 12 }}
                          >
                            {entry.origin === "phone" ? "Phone" : "Drive"} ·{" "}
                            {entry.sourceName}
                            {entry.size !== undefined
                              ? ` · ${formatBytes(entry.size)}`
                              : ""}
                          </Text>
                          {!!tags[entryKey(entry)]?.length && (
                            <Text
                              numberOfLines={1}
                              style={{ color: p.accent, fontSize: 12 }}
                            >
                              {tags[entryKey(entry)].join(" · ")}
                            </Text>
                          )}
                        </View>
                        <MaterialIcons
                          name="chevron-right"
                          size={20}
                          color={p.muted}
                        />
                      </Pressable>
                    ))
                  )}
                  {visible.length > 250 && (
                    <Label muted>
                      Showing the first 250 matches. Use Search or filters to
                      narrow the list.
                    </Label>
                  )}
                  {entries.length > 0 && tab === "Library" && actions}
                </>
              )}
            </ScrollView>
            <View
              style={[
                layout.nav,
                {
                  borderColor: p.line,
                  backgroundColor: p.bg,
                  paddingBottom: Math.max(insets.bottom, 12),
                },
              ]}
            >
              {nav.map((item) => (
                <Pressable
                  key={item.name}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === item.name }}
                  onPress={() => setTab(item.name)}
                  style={layout.navItem}
                >
                  <MaterialIcons
                    name={item.icon}
                    size={23}
                    color={tab === item.name ? p.accent : p.muted}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      color: tab === item.name ? p.accent : p.muted,
                      fontWeight: tab === item.name ? "600" : "400",
                    }}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        <Modal
          visible={!!selected}
          animationType="slide"
          onRequestClose={() => setSelected(null)}
        >
          <SafeAreaView
            style={{ flex: 1, backgroundColor: p.bg }}
            edges={["top", "bottom", "left", "right"]}
          >
            <ScrollView
              contentContainerStyle={layout.details}
              keyboardShouldPersistTaps="handled"
            >
              <Button title="Close" onPress={() => setSelected(null)} />
              {selected && (
                <>
                  <Label large>{selected.name}</Label>
                  {thumbnail(selected) && (
                    <Image
                      source={{ uri: thumbnail(selected) }}
                      style={{ height: 240, borderRadius: 12 }}
                      contentFit="contain"
                    />
                  )}
                  <Label muted>
                    {selected.origin === "phone" ? "Phone" : "Google Drive"} ·{" "}
                    {selected.sourceName}
                  </Label>
                  <Label muted>
                    {selected.relativePath ??
                      selected.description ??
                      selected.mimeType}
                  </Label>
                  <Label muted>
                    {selected.size !== undefined
                      ? formatBytes(selected.size)
                      : "Size unavailable"}
                    {selected.modifiedTime
                      ? ` · ${new Date(selected.modifiedTime).toLocaleDateString()}`
                      : ""}
                  </Label>
                  <Button
                    title={
                      selected.origin === "phone"
                        ? "Open on phone"
                        : "Open in Google Drive"
                    }
                    primary
                    onPress={() => void open()}
                  />
                  <Section title="Tags">
                    <Label muted>
                      Add tags separated by commas. Your edits stay saved on
                      this device when folders are rescanned.
                    </Label>
                    <TextInput
                      accessibilityLabel="File tags"
                      value={tagText}
                      onChangeText={setTagText}
                      placeholder="e.g. Car, Receipts, Holiday"
                      placeholderTextColor={p.muted}
                      style={[
                        layout.input,
                        { color: p.text, borderColor: p.line },
                      ]}
                      multiline
                    />
                    <Button
                      title="Save tags"
                      primary
                      onPress={() => {
                        setTags((previous) => ({
                          ...previous,
                          [entryKey(selected)]: parseTags(tagText),
                        }));
                        setSelected(null);
                      }}
                    />
                  </Section>
                  {selected.origin === "phone" && (
                    <Label muted>
                      This file stays on your phone. Only its metadata and your
                      tags are stored in Gallery.
                    </Label>
                  )}
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </PaletteContext.Provider>
  );
}
