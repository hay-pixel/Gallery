import { afterEach, expect, it, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GALLERY_SESSION_KEY,
  getGallerySessionToken,
} from "../lib/gallery-session";
vi.mock("../constants/oauth", () => ({ getApiBaseUrl: () => "" }));
afterEach(() => vi.unstubAllGlobals());
it("creates a signed session on a same-origin web deployment with no explicit API URL", async () => {
  await AsyncStorage.removeItem(GALLERY_SESSION_KEY);
  const requested: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    requested.push(url);
    return {
      ok: true,
      json: async () => ({
        result: { data: { json: { token: "signed-test-session" } } },
      }),
    };
  });
  expect(await getGallerySessionToken()).toBe("signed-test-session");
  expect(requested).toEqual(["/api/trpc/session.create"]);
});
