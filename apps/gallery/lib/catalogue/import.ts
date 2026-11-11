import { z } from "zod";
import {
  AssetIdSchema,
  AssetRecordV1Schema,
  type AssetRecordV1,
  type SourceOccurrenceRecordV1,
  SourceOccurrenceRecordV1Schema,
} from "./contracts";
import type { AssetId } from "./types";

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_PREVIEW_DATA_URI_BYTES = 256 * 1024;

const SafePreviewDataUriSchema = z
  .string()
  .max(
    MAX_PREVIEW_DATA_URI_BYTES,
    "previewDataUri exceeds bounded data URI limit",
  )
  .regex(
    /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/,
    "previewDataUri must be a bounded base64 data:image/ URI; remote/filesystem preview URLs are forbidden",
  );

export const CanonicalImportMetadataItemSchema = z
  .object({
    asset_id: AssetIdSchema,
    title: z.string().min(1).max(512).optional(),
    category: z.string().min(1).max(128).optional(),
    subcategory: z.string().min(1).max(128).optional(),
    dateTaken: z.string().min(1).max(64).optional(),
    dateSource: z.string().min(1).max(128).optional(),
    previewColor: z.string().min(1).max(32).optional(),
    previewDataUri: SafePreviewDataUriSchema.optional(),
    labels: z.array(z.string().min(1).max(64)).max(64).optional(),
  })
  .strict();

export type CanonicalImportMetadataItem = z.infer<
  typeof CanonicalImportMetadataItemSchema
>;

const CanonicalImportEnvelopeSchema = z
  .object({
    schema: z.literal("gallery-canonical-import"),
    schema_version: z.literal(1),
    assets: z.array(AssetRecordV1Schema).min(1),
    occurrences: z.array(SourceOccurrenceRecordV1Schema).optional().default([]),
    metadata: z.array(CanonicalImportMetadataItemSchema).optional().default([]),
  })
  .strict();

export type CanonicalImportBatch = {
  assets: AssetRecordV1[];
  occurrences: SourceOccurrenceRecordV1[];
  metadata: Record<AssetId, CanonicalImportMetadataItem>;
};

export function parseCanonicalImport(text: string): CanonicalImportBatch {
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("Canonical import payload must be a non-empty JSON string");
  }

  // Client runtimes do not provide Node's Buffer. Count UTF-8 including surrogate pairs.
  let byteLength = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) byteLength++;
    else if (code < 0x800) byteLength += 2;
    else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      i + 1 < text.length &&
      text.charCodeAt(i + 1) >= 0xdc00 &&
      text.charCodeAt(i + 1) <= 0xdfff
    ) {
      byteLength += 4;
      i++;
    } else byteLength += 3;
  }
  if (byteLength > MAX_IMPORT_BYTES) {
    throw new Error(
      `Canonical import payload exceeds maximum allowed size (${byteLength} > ${MAX_IMPORT_BYTES} bytes)`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `Invalid canonical import JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Canonical import payload must be a JSON object");
  }

  const schemaName = (raw as { schema?: unknown }).schema;
  const schemaVersion = (raw as { schema_version?: unknown }).schema_version;

  if (schemaVersion !== 1) {
    throw new Error(
      `Unsupported canonical import schema_version: ${String(schemaVersion)}`,
    );
  }

  if (schemaName === "asset-record") {
    const asset = AssetRecordV1Schema.parse(raw);
    if (asset.processing_state !== "ready") {
      throw new Error(
        `Canonical import requires processing_state "ready"; received "${asset.processing_state}"`,
      );
    }
    return {
      assets: [asset],
      occurrences: [],
      metadata: {},
    };
  }

  if (schemaName !== "gallery-canonical-import") {
    throw new Error(
      `Unsupported canonical import schema: ${String(schemaName)}`,
    );
  }

  const parsedEnvelope = CanonicalImportEnvelopeSchema.parse(raw);

  const seenAssetIds = new Set<AssetId>();
  for (const asset of parsedEnvelope.assets) {
    if (asset.processing_state !== "ready") {
      throw new Error(
        `Canonical import requires processing_state "ready" for ${asset.asset_id}; received "${asset.processing_state}"`,
      );
    }
    if (seenAssetIds.has(asset.asset_id)) {
      throw new Error(
        `Duplicate asset_id in canonical import batch: ${asset.asset_id}`,
      );
    }
    seenAssetIds.add(asset.asset_id);
  }

  const seenOccurrenceIds = new Set<string>();
  for (const occ of parsedEnvelope.occurrences) {
    if (seenOccurrenceIds.has(occ.source_occurrence_id)) {
      throw new Error(
        `Duplicate source_occurrence_id in canonical import batch: ${occ.source_occurrence_id}`,
      );
    }
    if (!seenAssetIds.has(occ.asset_id)) {
      throw new Error(
        `Orphan source_occurrence_id ${occ.source_occurrence_id} references unknown asset_id ${occ.asset_id}`,
      );
    }
    seenOccurrenceIds.add(occ.source_occurrence_id);
  }

  const metadataMap: Record<AssetId, CanonicalImportMetadataItem> = {};
  for (const meta of parsedEnvelope.metadata) {
    if (!seenAssetIds.has(meta.asset_id)) {
      throw new Error(
        `Orphan metadata entry references unknown asset_id ${meta.asset_id}`,
      );
    }
    if (metadataMap[meta.asset_id]) {
      throw new Error(`Duplicate metadata entry for asset_id ${meta.asset_id}`);
    }
    metadataMap[meta.asset_id] = meta;
  }

  return {
    assets: parsedEnvelope.assets,
    occurrences: parsedEnvelope.occurrences,
    metadata: metadataMap,
  };
}
