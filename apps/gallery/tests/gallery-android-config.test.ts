import { describe, expect, it } from "vitest";
import config from "../app.config";

describe("Gallery Android application configuration", () => {
  it("enforces exact package ID, version 1.1.0, and versionCode 6", () => {
    expect(config.android?.package).toBe("com.ollamabinsaden.gallery");
    expect(config.version).toBe("1.1.0");
    expect(config.android?.versionCode).toBe(6);
    expect(config.scheme).toBe("ollamabinsaden-gallery");
  });

  it("requests only minimum read permissions and forbids write permissions", () => {
    const permissions = config.android?.permissions ?? [];
    expect(permissions).not.toContain("WRITE_EXTERNAL_STORAGE");
    expect(permissions.some((p) => p.includes("READ_"))).toBe(true);
  });

  it("does not enable global cleartext traffic and leaks no raw Ollama host", () => {
    const androidConfig = config.android as Record<string, unknown>;
    expect(androidConfig.usesCleartextTraffic).toBeUndefined();

    const configStr = JSON.stringify(config);
    expect(configStr).not.toContain("11434");
    expect(configStr).not.toMatch(/EXPO_PUBLIC_[A-Z0-9_]*OLLAMA/i);
  });
});

