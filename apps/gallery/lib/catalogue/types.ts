import type { AssetRecordV1, SourceOccurrenceRecordV1 } from "./contracts";
import type { FileKind, ReviewState } from "../pixeldrive";

export type AssetId = string;
export type SourceOccurrenceId = string;

export type AnalysisStatus =
  | "pending"
  | "processing"
  | "ready"
  | "partial"
  | "unsupported"
  | "failed"
  | "stale";

export type ClassifierTagView = {
  tag: string;
  confidence: number;
  source: "classifier";
};

export type DetectedObjectView = {
  label: string;
  confidence: number;
  bbox?: [number, number, number, number];
  source: "detector";
};

export type AnalysisView = {
  asset_id: AssetId;
  analysis_id?: string | null;
  result_id?: string | null;
  status: AnalysisStatus;
  tags: ClassifierTagView[];
  detected_objects: DetectedObjectView[];
  ocr_text?: string;
  visual_description?: string;
  updated_at?: string;
};

export type GalleryAnnotations = {
  asset_id: AssetId;
  title?: string;
  kind?: FileKind;
  category?: string;
  subcategory?: string;
  dateTaken?: string;
  dateSource?: string;
  reviewState: ReviewState;
  reviewEvidence?: string;
  confidence?: number;
  duplicateGroupId?: string;
  isPreferredCopy?: boolean;
  preferredSourceOccurrenceId?: SourceOccurrenceId;
  isTechnicalSidecar?: boolean;
  isFlagged18Plus?: boolean;
  userNotes: string;
  labels: string[];
  previewColor?: string;
  previewDataUri?: string;
  updated_at: string;
};

export type SourceAccessState =
  | "granted"
  | "limited"
  | "denied"
  | "revoked"
  | "unavailable";

export type DiscoveredSourceItem = {
  discoveryHandle: string;
  providerKind: "local_media" | "document_picker" | "google_drive";
  displayName: string;
  uri: string;
  mimeType: string;
  sizeBytes?: number | null;
  modifiedAt?: string | null;
  accessState: SourceAccessState;
  linkedAssetId?: AssetId;
};

export type CapabilityStateSnapshot = {
  analysis: "ready" | "unavailable" | "partial" | "stale" | "failed";
  search: "ready" | "unavailable" | "stale" | "incompatible" | "failed";
  ollama: "ready" | "unavailable" | "disabled" | "failed";
};

export type GalleryCatalogueSnapshotV1 = {
  schema: "gallery-catalogue-cache";
  schema_version: 1;
  saved_at: string;
  canonical_assets: AssetRecordV1[];
  source_occurrences: SourceOccurrenceRecordV1[];
  analysis_views: AnalysisView[];
  annotations: Record<AssetId, GalleryAnnotations>;
  discovered_sources: DiscoveredSourceItem[];
  capability_state: CapabilityStateSnapshot;
};

export type CatalogueAssetView = {
  asset: AssetRecordV1;
  occurrences: SourceOccurrenceRecordV1[];
  analysis: AnalysisView | null;
  annotations: GalleryAnnotations;
  displayName: string;
  primaryOccurrence: SourceOccurrenceRecordV1 | null;
};

