import { describe, expect, it, vi } from "vitest";
import {
  parseCanonicalImport,
  MAX_IMPORT_BYTES,
} from "../lib/catalogue/import";

const record = {
  schema: "asset-record",
  schema_version: 1,
  asset_id: `sha256:${"a".repeat(64)}`,
  content_hash: `sha256:${"a".repeat(64)}`,
  storage_locator: "owned/a",
  mime_type: "image/png",
  size_bytes: 1,
  processing_state: "ready",
};

function parseWithoutBuffer(text: string) {
  vi.stubGlobal("Buffer", undefined);
  try {
    return parseCanonicalImport(text);
  } finally {
    vi.unstubAllGlobals();
  }
}
describe("canonical import in browser and native JS runtimes", () => {
  it("parses a valid record without the Node Buffer global", () => {
    expect(parseWithoutBuffer(JSON.stringify(record)).assets[0].asset_id).toBe(
      record.asset_id,
    );
  });
  it("counts UTF-8 bytes rather than characters for the import limit", () => {
    const payload = JSON.stringify({
      ...record,
      storage_locator: "界".repeat(Math.floor(MAX_IMPORT_BYTES / 3)),
    });
    expect(() => parseWithoutBuffer(payload)).toThrow(
      /exceeds maximum allowed size/,
    );
  });
});
