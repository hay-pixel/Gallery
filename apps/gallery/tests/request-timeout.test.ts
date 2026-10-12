import { describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "../lib/client-runtime";

describe("mobile request cancellation", () => {
  it("aborts a stalled request using AbortController without AbortSignal.timeout", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          );
        }),
    ) as typeof fetch;
    try {
      await expect(
        fetchWithTimeout("https://example.test", {}, 5),
      ).rejects.toThrow("aborted");
    } finally {
      globalThis.fetch = original;
    }
  });
});
