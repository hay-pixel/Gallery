import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createGalleryCacheStore,
  type CacheIO,
  type CacheSlot,
} from "./cache-store";

export type KeyValueStorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

const POINTER_KEY = "gallery:catalogue:pointer-v1";
const SLOT_KEYS: Record<CacheSlot, string> = {
  "slot-a": "gallery:catalogue:slot-a-v1",
  "slot-b": "gallery:catalogue:slot-b-v1",
};
const LEGACY_KEY = "gallery:catalogue:legacy-v0";

export function createDeviceCacheIO(
  storage: KeyValueStorageAdapter = AsyncStorage,
): CacheIO {
  return {
    async readPointer() {
      return storage.getItem(POINTER_KEY);
    },
    async writePointer(text: string) {
      await storage.setItem(POINTER_KEY, text);
    },
    async readSlot(slot: CacheSlot) {
      return storage.getItem(SLOT_KEYS[slot]);
    },
    async writeSlot(slot: CacheSlot, text: string) {
      await storage.setItem(SLOT_KEYS[slot], text);
    },
    async readLegacy() {
      return storage.getItem(LEGACY_KEY);
    },
    async clearLegacy() {
      await storage.removeItem(LEGACY_KEY);
    },
  };
}

export const galleryDeviceCache = createGalleryCacheStore(createDeviceCacheIO());

