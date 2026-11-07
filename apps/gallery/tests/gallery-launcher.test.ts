import { describe, expect, it } from "vitest";
import {
  COMPANION_TARGETS,
  deriveCompanionState,
  openCompanion,
} from "../lib/launcher/companion";

describe("Gallery optional companion launcher", () => {
  it("derives missing, unconfigured, incompatible, and ready companion states independently of Search/Ollama", () => {
    expect(
      deriveCompanionState({
        target: COMPANION_TARGETS.extract,
        installed: false,
      }).state,
    ).toBe("missing");

    expect(
      deriveCompanionState({
        target: COMPANION_TARGETS.extract,
        installed: true,
        configured: false,
      }).state,
    ).toBe("installed_unconfigured");

    expect(
      deriveCompanionState({
        target: COMPANION_TARGETS.extract,
        installed: true,
        configured: true,
        contractVersion: 99,
      }).state,
    ).toBe("incompatible");

    expect(
      deriveCompanionState({
        target: COMPANION_TARGETS.extract,
        installed: true,
        configured: true,
        contractVersion: 1,
      }).state,
    ).toBe("ready");
  });

  it("checks canOpenURL before opening and handles launch failures gracefully", async () => {
    const missingStatus = await openCompanion(COMPANION_TARGETS.extract, {
      canOpenURL: async () => false,
      openURL: async () => {
        throw new Error("should not be called");
      },
    });
    expect(missingStatus.state).toBe("missing");

    const launchFailedStatus = await openCompanion(COMPANION_TARGETS.assist, {
      canOpenURL: async () => true,
      openURL: async () => {
        throw new Error("Intent failed");
      },
    });
    expect(launchFailedStatus.state).toBe("launch_failed");

    let openedUrl = "";
    const readyStatus = await openCompanion(COMPANION_TARGETS.extract, {
      canOpenURL: async () => true,
      openURL: async (url) => {
        openedUrl = url;
      },
    });
    expect(readyStatus.state).toBe("ready");
    expect(openedUrl).toBe(COMPANION_TARGETS.extract.deepLinkUrl);
  });
});

