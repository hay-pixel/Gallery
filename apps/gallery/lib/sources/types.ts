import type { DiscoveredSourceItem, SourceAccessState } from "../catalogue/types";

export type { DiscoveredSourceItem, SourceAccessState };

export type SourceDiscoveryPage = {
  accessState: SourceAccessState;
  items: DiscoveredSourceItem[];
  hasNextPage: boolean;
  nextCursor: string | null;
};

export type MediaLibraryPermissionResponse = {
  status: "granted" | "denied" | "undetermined";
  accessPrivileges?: "all" | "limited" | "none";
  canAskAgain?: boolean;
};

export type MediaLibraryAssetItem = {
  id: string;
  filename: string;
  uri: string;
  mediaType?: "photo" | "video" | "audio" | "unknown" | string;
  modificationTime?: number;
};

export type MediaLibraryPageResponse = {
  assets: MediaLibraryAssetItem[];
  hasNextPage: boolean;
  endCursor?: string | null;
};

export type MediaLibraryAdapter = {
  getPermissionsAsync(): Promise<MediaLibraryPermissionResponse>;
  requestPermissionsAsync(): Promise<MediaLibraryPermissionResponse>;
  getAssetsAsync(options: {
    first: number;
    after?: string;
  }): Promise<MediaLibraryPageResponse>;
};

export type DocumentPickerAssetItem = {
  name: string;
  uri: string;
  mimeType?: string | null;
  size?: number | null;
};

export type DocumentPickerResponse =
  | { canceled: true; assets: null }
  | { canceled: false; assets: DocumentPickerAssetItem[] };

export type DocumentPickerAdapter = {
  getDocumentAsync(options?: {
    type?: string | string[];
    copyToCacheDirectory?: boolean;
    multiple?: boolean;
  }): Promise<DocumentPickerResponse>;
};

export type SourceAccessProbeAdapter = {
  canReadUri(uri: string): Promise<boolean>;
};

