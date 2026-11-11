// These SSR tests run in Node; OS storage, deep links, and safe-area metrics belong
// to native/browser acceptance tests, not Expo's native-module bootstrap in Node.
import { vi } from "vitest";
vi.mock("expo-linking", () => ({
  createURL: (path: string) =>
    `ollamabinsaden-gallery://${path.replace(/^\//, "")}`,
  canOpenURL: async () => true,
  openURL: async () => undefined,
}));
vi.mock("@react-native-async-storage/async-storage", () => {
  const storage = new Map<string, string>();
  return {
    default: {
      getItem: async (key: string) => storage.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: async (key: string) => {
        storage.delete(key);
      },
    },
  };
});
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 0 }),
}));
