import { z } from "zod";

export const ASSET_ID_PATTERN = /^sha256:[0-9a-f]{64}$/;
export const SOURCE_OCCURRENCE_ID_PATTERN = /^occurrence:sha256:[0-9a-f]{64}$/;

export const AssetIdSchema = z
  .string()
  .regex(ASSET_ID_PATTERN, "asset_id must match sha256:<64 lowercase hex characters>");

export const SourceOccurrenceIdSchema = z
  .string()
  .regex(
    SOURCE_OCCURRENCE_ID_PATTERN,
    "source_occurrence_id must match occurrence:sha256:<64 lowercase hex characters>",
  );

export const AssetRecordV1Schema = z
  .object({
    schema: z.literal("asset-record"),
    schema_version: z.literal(1),
    asset_id: AssetIdSchema,
    content_hash: AssetIdSchema,
    storage_locator: z.string().min(1),
    mime_type: z.string().min(1),
    size_bytes: z.number().int().min(0),
    processing_state: z.enum(["ready", "failed"]),
  })
  .strict()
  .refine((record) => record.asset_id === record.content_hash, {
    message: "asset_id must equal content_hash for asset-record v1",
    path: ["content_hash"],
  });

export type AssetRecordV1 = z.infer<typeof AssetRecordV1Schema>;

export const SourceOccurrenceRecordV1Schema = z
  .object({
    schema: z.literal("source-occurrence-record"),
    schema_version: z.literal(1),
    source_occurrence_id: SourceOccurrenceIdSchema,
    asset_id: AssetIdSchema,
    source_id: z.string().min(1),
    source_kind: z.string().min(1),
    source_location: z.string().min(1),
    original_path: z.string().min(1),
    ingest_job_id: z.string().min(1),
    observed_at: z.string().min(1),
    source_archive_id: z.string().nullable().optional().default(null),
    source_archive_location: z.string().nullable().optional().default(null),
    source_member: z.string().nullable().optional().default(null),
  })
  .strict();

export type SourceOccurrenceRecordV1 = z.infer<typeof SourceOccurrenceRecordV1Schema>;

export function parseAssetRecordV1(input: unknown): AssetRecordV1 {
  return AssetRecordV1Schema.parse(input);
}

export function parseSourceOccurrenceRecordV1(input: unknown): SourceOccurrenceRecordV1 {
  return SourceOccurrenceRecordV1Schema.parse(input);
}

export function isValidAssetId(value: string): boolean {
  return ASSET_ID_PATTERN.test(value);
}

export function isValidSourceOccurrenceId(value: string): boolean {
  return SOURCE_OCCURRENCE_ID_PATTERN.test(value);
}

