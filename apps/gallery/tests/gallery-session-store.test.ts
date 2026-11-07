import { describe, expect, it } from "vitest";
import { createGallerySessionStore } from "../lib/session/gallery-session-store";

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: async (key: string) => map.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: async (key: string) => {
      map.delete(key);
    },
  };
}

describe("Gallery session store", () => {
  it("persists sessions across restart and isolates tokens per approved API origin", async () => {
    const storage = createMemoryStorage();
    const storeA1 = createGallerySessionStore(storage, "https://gallery-a.example.com");
    const storeB = createGallerySessionStore(storage, "https://gallery-b.example.com");

    await storeA1.setToken("jwt-token-origin-a");
    await storeB.setToken("jwt-token-origin-b");

    // Simulate restart on origin A
    const storeA2 = createGallerySessionStore(storage, "https://gallery-a.example.com");
    expect(await storeA2.getToken()).toBe("jwt-token-origin-a");
    expect(await storeB.getToken()).toBe("jwt-token-origin-b");

    // Storage keys must never embed the raw URL or token
    for (const key of storage.map.keys()) {
      expect(key).not.toContain("gallery-a.example.com");
      expect(key).not.toContain("jwt-token");
      expect(key).toMatch(/^[A-Za-z0-9._-]+$/);
    }
  });

  it("returns null before configuration and rejects credentialed or unsafe origins", async () => {
    const storage = createMemoryStorage();
    const unconfigured = createGallerySessionStore(storage, null);
    expect(await unconfigured.getToken()).toBeNull();
    await expect(unconfigured.setToken("token")).rejects.toThrow(/configured|origin/i);

    expect(() =>
      createGallerySessionStore(storage, "https://user:secret@gallery.example.com"),
    ).toThrow(/credential/i);

    expect(() =>
      createGallerySessionStore(storage, "ftp://gallery.example.com"),
    ).toThrow(/protocol|http/i);

    expect(() =>
      createGallerySessionStore(storage, "http://remote-insecure.example.com"),
    ).toThrow(/https|localhost/i);
  });
});

