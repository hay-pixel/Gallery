import { describe, expect, it, vi } from "vitest";
import {
  UnavailableOllamaGateway,
  validateGroundedAnswerResponse,
} from "../server/ollama-gateway";
import type { GroundedAnswer } from "../lib/ollama/types";

const ASSET_1 = "sha256:1b8f40e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0011";
const ASSET_2 = "sha256:2f6c40e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0042";

describe("Gallery private Ollama consumer boundary", () => {
  it("defaults to typed unavailable without making network calls or exposing host/token fields", async () => {
    const gateway = new UnavailableOllamaGateway();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const health = await gateway.health();
    expect(health.state).toBe("unavailable");
    expect((health as Record<string, unknown>).host).toBeUndefined();
    expect((health as Record<string, unknown>).token).toBeUndefined();

    const models = await gateway.models();
    expect(models.state).toBe("unavailable");
    expect(models.models).toEqual([]);

    const capabilities = await gateway.capabilities();
    expect(capabilities.state).toBe("unavailable");

    const answer = await gateway.answerWithGrounding({
      question: "Where are the speaker wires?",
      evidenceAssetIds: [ASSET_1],
    });
    expect(answer.state).toBe("unavailable");
    expect(answer.citations).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it("short-circuits grounded answer when no evidenceAssetIds are provided", async () => {
    const gateway = new UnavailableOllamaGateway();
    const answer = await gateway.answerWithGrounding({
      question: "What is in my archive?",
      evidenceAssetIds: [],
    });
    expect(answer.state).toBe("no_evidence");
    expect(answer.citations).toEqual([]);
    expect(answer.limitations.length).toBeGreaterThan(0);
  });

  it("enforces exact canonical citations subset of evidenceAssetIds and rejects raw host leakage", () => {
    const valid: GroundedAnswer = {
      state: "ready",
      answer: "Found speaker wire reference photo.",
      citations: [ASSET_1],
      limitations: [],
      model: "qwen2.5:7b",
    };
    expect(validateGroundedAnswerResponse(valid, [ASSET_1, ASSET_2]).citations).toEqual([
      ASSET_1,
    ]);

    // Hallucinated citation not in evidence set must be rejected
    expect(() =>
      validateGroundedAnswerResponse(
        {
          state: "ready",
          answer: "Hallucinated citation.",
          citations: [ASSET_2],
          limitations: [],
        },
        [ASSET_1],
      ),
    ).toThrow(/citation|evidence/i);

    // Non-canonical citation ID must be rejected
    expect(() =>
      validateGroundedAnswerResponse(
        {
          state: "ready",
          answer: "Bad citation.",
          citations: ["drive-photo-0001"],
          limitations: [],
        },
        ["drive-photo-0001"],
      ),
    ).toThrow(/asset_id|sha256/i);
  });
});

