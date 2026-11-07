import { parseAssetRecordV1, parseSourceOccurrenceRecordV1 } from "./contracts";
import type { GalleryCatalogueSnapshotV1 } from "./types";
import { validateSnapshotIntegrity } from "./view-model";

export type CacheSlot = "slot-a" | "slot-b";

export type CachePointer = {
  schema: "gallery-cache-pointer";
  schema_version: 1;
  activeSlot: CacheSlot;
  savedAt: string;
};

export type CacheIO = {
  readPointer(): Promise<string | null>;
  writePointer(text: string): Promise<void>;
  readSlot(slot: CacheSlot): Promise<string | null>;
  writeSlot(slot: CacheSlot, text: string): Promise<void>;
  readLegacy?(): Promise<string | null>;
  clearLegacy?(): Promise<void>;
};

export type InMemoryCacheIO = CacheIO & {
  failNextSlotWrite: boolean;
  failNextPointerWrite: boolean;
};

function parsePointer(text: string | null): CachePointer | null {
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as Partial<CachePointer>;
    if (
      raw.schema === "gallery-cache-pointer" &&
      raw.schema_version === 1 &&
      (raw.activeSlot === "slot-a" || raw.activeSlot === "slot-b") &&
      typeof raw.savedAt === "string"
    ) {
      return raw as CachePointer;
    }
    return null;
  } catch {
    return null;
  }
}

function parseSnapshotText(text: string | null): GalleryCatalogueSnapshotV1 | null {
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as Partial<GalleryCatalogueSnapshotV1>;
    if (
      !raw ||
      raw.schema !== "gallery-catalogue-cache" ||
      raw.schema_version !== 1 ||
      typeof raw.saved_at !== "string" ||
      !Array.isArray(raw.canonical_assets) ||
      !Array.isArray(raw.source_occurrences) ||
      !Array.isArray(raw.analysis_views) ||
      !raw.annotations ||
      typeof raw.annotations !== "object" ||
      !Array.isArray(raw.discovered_sources) ||
      !raw.capability_state ||
      typeof raw.capability_state !== "object"
    ) {
      return null;
    }

    const snapshot: GalleryCatalogueSnapshotV1 = {
      schema: "gallery-catalogue-cache",
      schema_version: 1,
      saved_at: raw.saved_at,
      canonical_assets: raw.canonical_assets.map((item) => parseAssetRecordV1(item)),
      source_occurrences: raw.source_occurrences.map((item) =>
        parseSourceOccurrenceRecordV1(item),
      ),
      analysis_views: structuredClone(raw.analysis_views),
      annotations: structuredClone(raw.annotations),
      discovered_sources: structuredClone(raw.discovered_sources),
      capability_state: structuredClone(raw.capability_state),
    };

    validateSnapshotIntegrity(snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

function oppositeSlot(slot: CacheSlot): CacheSlot {
  return slot === "slot-a" ? "slot-b" : "slot-a";
}

export function createInMemoryCacheIO(): InMemoryCacheIO {
  let pointerText: string | null = null;
  const slots: Record<CacheSlot, string | null> = {
    "slot-a": null,
    "slot-b": null,
  };
  let legacyText: string | null = null;

  const io: InMemoryCacheIO = {
    failNextSlotWrite: false,
    failNextPointerWrite: false,
    async readPointer() {
      return pointerText;
    },
    async writePointer(text: string) {
      if (io.failNextPointerWrite) {
        io.failNextPointerWrite = false;
        throw new Error("Simulated pointer write failed");
      }
      pointerText = text;
    },
    async readSlot(slot: CacheSlot) {
      return slots[slot];
    },
    async writeSlot(slot: CacheSlot, text: string) {
      if (io.failNextSlotWrite) {
        io.failNextSlotWrite = false;
        throw new Error("Simulated slot write failed");
      }
      slots[slot] = text;
    },
    async readLegacy() {
      return legacyText;
    },
    async clearLegacy() {
      legacyText = null;
    },
  };

  return io;
}

export function createGalleryCacheStore(io: CacheIO): {
  read(): Promise<GalleryCatalogueSnapshotV1 | null>;
  write(snapshot: GalleryCatalogueSnapshotV1): Promise<void>;
} {
  let writeQueue: Promise<void> = Promise.resolve();

  async function readInternal(): Promise<{
    snapshot: GalleryCatalogueSnapshotV1 | null;
    activeSlot: CacheSlot | null;
  }> {
    const pointer = parsePointer(await io.readPointer());
    if (pointer) {
      const primary = parseSnapshotText(await io.readSlot(pointer.activeSlot));
      if (primary) {
        return { snapshot: primary, activeSlot: pointer.activeSlot };
      }
      const fallbackSlot = oppositeSlot(pointer.activeSlot);
      const fallback = parseSnapshotText(await io.readSlot(fallbackSlot));
      if (fallback) {
        return { snapshot: fallback, activeSlot: fallbackSlot };
      }
    } else {
      const slotA = parseSnapshotText(await io.readSlot("slot-a"));
      const slotB = parseSnapshotText(await io.readSlot("slot-b"));
      if (slotA && slotB) {
        return slotB.saved_at >= slotA.saved_at
          ? { snapshot: slotB, activeSlot: "slot-b" }
          : { snapshot: slotA, activeSlot: "slot-a" };
      }
      if (slotA) {
        return { snapshot: slotA, activeSlot: "slot-a" };
      }
      if (slotB) {
        return { snapshot: slotB, activeSlot: "slot-b" };
      }
    }

    if (io.readLegacy) {
      const legacyText = await io.readLegacy();
      const migrated = parseSnapshotText(legacyText);
      if (migrated) {
        await writeSnapshotToInactiveSlot(migrated, null);
        if (io.clearLegacy) {
          await io.clearLegacy();
        }
        return { snapshot: migrated, activeSlot: "slot-a" };
      }
    }

    return { snapshot: null, activeSlot: null };
  }

  async function writeSnapshotToInactiveSlot(
    snapshot: GalleryCatalogueSnapshotV1,
    currentSlot: CacheSlot | null,
  ): Promise<void> {
    validateSnapshotIntegrity(snapshot);
    const targetSlot: CacheSlot = currentSlot ? oppositeSlot(currentSlot) : "slot-a";
    const serialized = JSON.stringify(snapshot);
    await io.writeSlot(targetSlot, serialized);

    const pointer: CachePointer = {
      schema: "gallery-cache-pointer",
      schema_version: 1,
      activeSlot: targetSlot,
      savedAt: snapshot.saved_at,
    };
    await io.writePointer(JSON.stringify(pointer));
  }

  return {
    async read(): Promise<GalleryCatalogueSnapshotV1 | null> {
      await writeQueue.catch(() => undefined);
      const { snapshot } = await readInternal();
      return snapshot ? structuredClone(snapshot) : null;
    },

    write(snapshot: GalleryCatalogueSnapshotV1): Promise<void> {
      const cloned = structuredClone(snapshot);
      const nextOp = writeQueue
        .catch(() => undefined)
        .then(async () => {
          const pointer = parsePointer(await io.readPointer());
          await writeSnapshotToInactiveSlot(cloned, pointer?.activeSlot ?? null);
        });
      writeQueue = nextOp;
      return nextOp;
    },
  };
}

