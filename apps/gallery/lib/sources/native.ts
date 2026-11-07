import type {
  DiscoveredSourceItem,
  DocumentPickerAdapter,
  MediaLibraryAdapter,
  MediaLibraryPermissionResponse,
  SourceAccessProbeAdapter,
  SourceAccessState,
  SourceDiscoveryPage,
} from "./types";

function deriveMediaAccessState(perm: MediaLibraryPermissionResponse): SourceAccessState {
  if (perm.status !== "granted") {
    return "denied";
  }
  if (perm.accessPrivileges === "limited") {
    return "limited";
  }
  return "granted";
}

function inferMimeFromMediaAsset(filename: string, mediaType?: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".mp4") || mediaType === "video") return "video/mp4";
  return "image/jpeg";
}

export async function discoverLocalMediaSources(
  adapter: MediaLibraryAdapter,
  after?: string,
  pageSize: number = 50,
): Promise<SourceDiscoveryPage> {
  let perm = await adapter.getPermissionsAsync();
  if (perm.status === "undetermined" && perm.canAskAgain !== false) {
    perm = await adapter.requestPermissionsAsync();
  }

  const accessState = deriveMediaAccessState(perm);
  if (accessState === "denied") {
    return {
      accessState: "denied",
      items: [],
      hasNextPage: false,
      nextCursor: null,
    };
  }

  const page = await adapter.getAssetsAsync({
    first: pageSize,
    after,
  });

  const endCursor = page.endCursor ?? null;
  const cursorDidNotAdvance = Boolean(after && endCursor === after);
  const hasNextPage = Boolean(page.hasNextPage && endCursor && !cursorDidNotAdvance);

  const items: DiscoveredSourceItem[] = page.assets.map((asset) => ({
    discoveryHandle: `local_media:${asset.id}`,
    providerKind: "local_media",
    displayName: asset.filename,
    uri: asset.uri,
    mimeType: inferMimeFromMediaAsset(asset.filename, asset.mediaType),
    sizeBytes: null,
    modifiedAt:
      typeof asset.modificationTime === "number"
        ? new Date(asset.modificationTime).toISOString()
        : null,
    accessState,
  }));

  return {
    accessState,
    items,
    hasNextPage,
    nextCursor: hasNextPage ? endCursor : null,
  };
}

export async function pickDocumentSources(
  adapter: DocumentPickerAdapter,
): Promise<SourceDiscoveryPage> {
  const res = await adapter.getDocumentAsync({
    type: ["image/*", "video/*", "application/pdf", "text/*"],
    copyToCacheDirectory: false,
    multiple: true,
  });

  if (res.canceled || !res.assets) {
    return {
      accessState: "granted",
      items: [],
      hasNextPage: false,
      nextCursor: null,
    };
  }

  const items: DiscoveredSourceItem[] = res.assets.map((doc, idx) => ({
    discoveryHandle: `document_picker:${idx}:${encodeURIComponent(doc.name)}`,
    providerKind: "document_picker",
    displayName: doc.name,
    uri: doc.uri,
    mimeType: doc.mimeType ?? "application/octet-stream",
    sizeBytes: doc.size ?? null,
    modifiedAt: null,
    accessState: "granted",
  }));

  return {
    accessState: "granted",
    items,
    hasNextPage: false,
    nextCursor: null,
  };
}

export async function verifySourceHandleAccess(
  item: DiscoveredSourceItem,
  probe: SourceAccessProbeAdapter,
): Promise<DiscoveredSourceItem> {
  try {
    const readable = await probe.canReadUri(item.uri);
    return {
      ...structuredClone(item),
      accessState: readable ? item.accessState : "revoked",
    };
  } catch {
    return {
      ...structuredClone(item),
      accessState: "revoked",
    };
  }
}

