import type { ChatMessage, FileRecord } from "./pixeldrive";

export type DriveMetadata = {
  id: string;
  name: string;
  mimeType: string;
  sourceId: number;
  sourceName: string;
  description?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  hasThumbnail?: boolean;
  mediaGrant?: string;
  thumbnailGrant?: string;
};

export function normaliseBackendUrl(value: string): string {
  if (!value.trim()) return "";
  const url = new URL(value.trim());
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(url.protocol === "http:" && local)) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "Enter an HTTPS server address without a path, password or query.",
    );
  }
  return url.origin;
}

export function safeExternalUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function searchDriveFiles<T extends DriveMetadata>(
  files: T[],
  query: string,
): T[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return files.filter((file) =>
    terms.every((term) =>
      [file.name, file.description, file.sourceName, file.mimeType]
        .join(" ")
        .toLowerCase()
        .includes(term),
    ),
  );
}

export function restoreLibraryState(value: string | null): {
  files: FileRecord[];
  chat: ChatMessage[];
} {
  // v3 stores only canonical records; inherited demo state is never a real archive.
  try {
    const state = JSON.parse(value ?? "{}");
    if (
      state.version !== 3 ||
      !Array.isArray(state.files) ||
      !Array.isArray(state.chat)
    )
      return { files: [], chat: [] };
    const files = state.files.filter(
      (file: FileRecord) =>
        /^sha256:[a-f0-9]{64}$/.test(file.assetId) &&
        Array.isArray(file.sources) &&
        !file.sources.some((source) => source.sourceKind === "fixture"),
    );
    return {
      files,
      chat: state.chat.filter(
        (message: ChatMessage) =>
          typeof message.content === "string" &&
          ["user", "assistant"].includes(message.role),
      ),
    };
  } catch {
    return { files: [], chat: [] };
  }
}

export function cacheDriveFiles(files: DriveMetadata[]): DriveMetadata[] {
  return files.map(
    ({ mediaGrant: _media, thumbnailGrant: _thumbnail, ...file }) => file,
  );
}

export function mergeDriveAvailability(
  live: DriveMetadata[],
  cached: DriveMetadata[],
  unavailableSourceIds: number[],
): DriveMetadata[] {
  const failed = new Set(unavailableSourceIds);
  return [
    ...live,
    ...cacheDriveFiles(cached.filter((file) => failed.has(file.sourceId))),
  ];
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  options: RequestInit = {},
  timeoutMs = 20000,
): Promise<Response> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (options.signal?.aborted) cancel();
  options.signal?.addEventListener("abort", cancel);
  const timer = setTimeout(cancel, timeoutMs);
  try {
    return await fetch(input, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}

let runtimeBackend: string | undefined;
export const setRuntimeBackend = (url: string) => {
  runtimeBackend = url;
};
export const getRuntimeBackend = () => runtimeBackend;
