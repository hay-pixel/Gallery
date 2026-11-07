import { isValidAssetId } from "../lib/catalogue/contracts";
import type {
  GroundedAnswer,
  GroundedAnswerInput,
  OllamaCapabilitiesResponse,
  OllamaHealth,
  OllamaModelsResponse,
} from "../lib/ollama/types";

export interface OllamaGateway {
  health(): Promise<OllamaHealth>;
  models(): Promise<OllamaModelsResponse>;
  capabilities(): Promise<OllamaCapabilitiesResponse>;
  answerWithGrounding(input: GroundedAnswerInput): Promise<GroundedAnswer>;
}

export function validateGroundedAnswerResponse(
  response: GroundedAnswer,
  allowedEvidenceAssetIds: readonly string[],
): GroundedAnswer {
  const allowedSet = new Set<string>(allowedEvidenceAssetIds);

  for (const id of allowedEvidenceAssetIds) {
    if (!isValidAssetId(id)) {
      throw new Error(`Evidence asset_id must match sha256:<64 lowercase hex>: ${id}`);
    }
  }

  for (const cited of response.citations) {
    if (!isValidAssetId(cited)) {
      throw new Error(`Citation must be a canonical sha256 asset_id: ${cited}`);
    }
    if (!allowedSet.has(cited)) {
      throw new Error(
        `Citation ${cited} was not present in the supplied grounding evidence set`,
      );
    }
  }

  const rawRecord = response as Record<string, unknown>;
  if ("host" in rawRecord || "token" in rawRecord || "endpoint" in rawRecord) {
    throw new Error("GroundedAnswer must never expose raw Ollama host, endpoint, or token");
  }

  return structuredClone(response);
}

export class UnavailableOllamaGateway implements OllamaGateway {
  async health(): Promise<OllamaHealth> {
    return {
      state: "unavailable",
      defaultModel: null,
      detail:
        "Private Ollama reasoning adapter is unavailable. Catalogue browse and deterministic Search remain active.",
    };
  }

  async models(): Promise<OllamaModelsResponse> {
    return {
      state: "unavailable",
      models: [],
      detail: "No server-managed Ollama models are currently reachable.",
    };
  }

  async capabilities(): Promise<OllamaCapabilitiesResponse> {
    return {
      state: "unavailable",
      capabilities: [
        { capability: "grounded_answer", available: false, reason: "Service unavailable" },
        { capability: "query_planning", available: false, reason: "Service unavailable" },
        { capability: "explanation", available: false, reason: "Service unavailable" },
        { capability: "vision", available: false, reason: "Service unavailable" },
      ],
      detail: "Ollama reasoning capabilities are offline.",
    };
  }

  async answerWithGrounding(input: GroundedAnswerInput): Promise<GroundedAnswer> {
    for (const id of input.evidenceAssetIds) {
      if (!isValidAssetId(id)) {
        throw new Error(`Invalid canonical evidence asset_id: ${id}`);
      }
    }

    if (input.evidenceAssetIds.length === 0) {
      return {
        state: "no_evidence",
        answer:
          "No supporting canonical catalogue records were supplied to ground an answer.",
        citations: [],
        limitations: [
          "Grounded answers require at least one canonical asset_id from Search or catalogue selection.",
        ],
        model: null,
      };
    }

    return {
      state: "unavailable",
      answer:
        "Private Ollama reasoning is currently unavailable. Review the grounded catalogue records directly.",
      citations: [],
      limitations: ["Server-side Ollama reasoning service is offline."],
      model: null,
    };
  }
}

export const defaultOllamaGateway: OllamaGateway = new UnavailableOllamaGateway();

