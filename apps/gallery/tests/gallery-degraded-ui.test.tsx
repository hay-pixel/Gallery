import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CapabilityBanner } from "../components/capability-banner";
import { OllamaSettingsScreen } from "../features/settings/ollama-settings-screen";

describe("Gallery degraded states and truthful capability UI", () => {
  it("renders honest capability banner states without claiming false availability", () => {
    const unavail = renderToStaticMarkup(
      <CapabilityBanner
        serviceName="Search service"
        status="unavailable"
        detail="Using local catalogue browse."
      />,
    );
    expect(unavail).toContain("Search service unavailable");
    expect(unavail).toContain("Using local catalogue browse.");

    const stale = renderToStaticMarkup(
      <CapabilityBanner
        serviceName="Semantic index"
        status="stale"
        detail="Re-indexing pending."
      />,
    );
    expect(stale).toContain("Semantic index stale");
  });

  it("renders Ollama settings with status and models, strictly forbidding raw endpoints or tokens", () => {
    const markup = renderToStaticMarkup(
      <OllamaSettingsScreen
        health={{
          state: "unavailable",
          defaultModel: null,
          detail: "Private Ollama reasoning daemon is offline.",
        }}
        models={[]}
      />,
    );
    expect(markup).toContain("Private Ollama reasoning daemon is offline.");
    expect(markup).not.toContain("11434");
    expect(markup).not.toMatch(/token/i);
    expect(markup).not.toMatch(/http:\/\/.*:11434/i);
    expect(markup).not.toMatch(/host:/i);
  });
});
