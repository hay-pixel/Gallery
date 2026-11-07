export type CompanionId = "extract" | "assist";

export type CompanionTarget = {
  id: CompanionId;
  displayName: string;
  deepLinkUrl: string;
  supportedContractVersion: number;
};

export const COMPANION_TARGETS: Record<CompanionId, CompanionTarget> = {
  extract: {
    id: "extract",
    displayName: "Ollamabinsaden Extract",
    deepLinkUrl: "ollamabinsaden-extract://open",
    supportedContractVersion: 1,
  },
  assist: {
    id: "assist",
    displayName: "Ollamabinsaden Assist",
    deepLinkUrl: "ollamabinsaden-assist://open",
    supportedContractVersion: 1,
  },
};

export type CompanionState =
  | "missing"
  | "installed_unconfigured"
  | "incompatible"
  | "ready"
  | "launch_failed";

export type CompanionProbeInput = {
  target: CompanionTarget;
  installed: boolean;
  configured?: boolean;
  contractVersion?: number;
};

export type CompanionStatus = {
  id: CompanionId;
  displayName: string;
  state: CompanionState;
  detail: string;
};

export type CompanionLinkingAdapter = {
  canOpenURL(url: string): Promise<boolean>;
  openURL(url: string): Promise<void>;
};

export function deriveCompanionState(probe: CompanionProbeInput): CompanionStatus {
  const { target, installed, configured = true, contractVersion = 1 } = probe;

  if (!installed) {
    return {
      id: target.id,
      displayName: target.displayName,
      state: "missing",
      detail: `${target.displayName} is not installed on this device. Gallery works standalone without it.`,
    };
  }

  if (!configured) {
    return {
      id: target.id,
      displayName: target.displayName,
      state: "installed_unconfigured",
      detail: `${target.displayName} is installed but not yet configured.`,
    };
  }

  if (contractVersion !== target.supportedContractVersion) {
    return {
      id: target.id,
      displayName: target.displayName,
      state: "incompatible",
      detail: `${target.displayName} contract v${contractVersion} is incompatible with expected v${target.supportedContractVersion}.`,
    };
  }

  return {
    id: target.id,
    displayName: target.displayName,
    state: "ready",
    detail: `${target.displayName} is available.`,
  };
}

export async function openCompanion(
  target: CompanionTarget,
  linking: CompanionLinkingAdapter,
): Promise<CompanionStatus> {
  let supported = false;
  try {
    supported = await linking.canOpenURL(target.deepLinkUrl);
  } catch {
    supported = false;
  }

  if (!supported) {
    return deriveCompanionState({ target, installed: false });
  }

  try {
    await linking.openURL(target.deepLinkUrl);
    return deriveCompanionState({
      target,
      installed: true,
      configured: true,
      contractVersion: target.supportedContractVersion,
    });
  } catch (err) {
    return {
      id: target.id,
      displayName: target.displayName,
      state: "launch_failed",
      detail: `Failed to launch ${target.displayName}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

