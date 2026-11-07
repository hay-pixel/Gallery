import type { AssetId } from "../catalogue/types";

export type OllamaAvailability =
  | "ready"
  | "unavailable"
  | "disabled"
  | "model_unavailable"
  | "unsupported_capability"
  | "timeout"
  | "failed"
  | "no_evidence";

export type OllamaCapabilityName =
  | "grounded_answer"
  | "query_planning"
  | "explanation"
  | "vision";

export type OllamaHealth = {
  state: OllamaAvailability;
  defaultModel: string | null;
  detail: string;
};

export type OllamaModel = {
  name: string;
  capabilities: OllamaCapabilityName[];
};

export type OllamaModelsResponse = {
  state: OllamaAvailability;
  models: OllamaModel[];
  detail?: string;
};

export type OllamaCapability = {
  capability: OllamaCapabilityName;
  available: boolean;
  reason?: string;
};

export type OllamaCapabilitiesResponse = {
  state: OllamaAvailability;
  capabilities: OllamaCapability[];
  detail?: string;
};

export type GroundedAnswerInput = {
  question: string;
  evidenceAssetIds: AssetId[];
  model?: string;
};

export type GroundedAnswer = {
  state: OllamaAvailability;
  answer: string;
  citations: AssetId[];
  limitations: string[];
  model?: string | null;
};

