import {
  MAX_IMPORT_BYTES,
  parseCanonicalImport,
  type CanonicalImportBatch,
} from "./import";

export type PickedImportDocument =
  | { canceled: true }
  | {
      canceled: false;
      name: string;
      mimeType?: string | null;
      sizeBytes?: number | null;
      uri: string;
    };

export type CanonicalImportPicker = {
  pickDocument(): Promise<PickedImportDocument>;
  readText(uri: string): Promise<string>;
};

function isJsonDocument(name: string, mimeType?: string | null): boolean {
  const lowerName = name.toLowerCase();
  const lowerMime = (mimeType ?? "").toLowerCase();
  return (
    lowerName.endsWith(".json") ||
    lowerMime === "application/json" ||
    lowerMime.endsWith("+json")
  );
}

export async function pickCanonicalImport(
  adapter?: CanonicalImportPicker,
): Promise<CanonicalImportBatch | null> {
  if (!adapter) {
    throw new Error("CanonicalImportPicker adapter is required");
  }

  const picked = await adapter.pickDocument();
  if (picked.canceled) {
    return null;
  }

  if (!isJsonDocument(picked.name, picked.mimeType)) {
    throw new Error(
      `Canonical import requires a .json file (received "${picked.name}", mime "${picked.mimeType ?? "unknown"}")`,
    );
  }

  if (typeof picked.sizeBytes === "number" && picked.sizeBytes > MAX_IMPORT_BYTES) {
    throw new Error(
      `Selected canonical import file exceeds maximum size (${picked.sizeBytes} > ${MAX_IMPORT_BYTES} bytes)`,
    );
  }

  const text = await adapter.readText(picked.uri);
  return parseCanonicalImport(text);
}

