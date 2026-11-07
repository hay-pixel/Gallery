import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(root: string): string[] { return readdirSync(root).flatMap((name) => { if (["node_modules", "dist", ".expo"].includes(name)) return []; const path = join(root, name); return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx|js|json)$/.test(name) ? [path] : []; }); }

describe("runtime independence and source boundaries", () => {
  it("has no Codex, Manus, Forge, or space.manus runtime coupling", () => {
    const root = join(process.cwd());
    const findings = sourceFiles(root).filter((path) => !path.includes("tests/runtime-independence")).flatMap((path) => /(?:BUILT_IN_FORGE|space\.manus|forge\.manus|codex api|codex sdk)/i.test(readFileSync(path, "utf8")) ? [relative(root, path)] : []);
    expect(findings).toEqual([]);
  });

  it("keeps Drive provider IDs explicitly source-scoped rather than canonical", () => {
    const types = readFileSync(join(process.cwd(), "lib/catalogue/types.ts"), "utf8");
    expect(types).toContain("export type DiscoveredSourceItem");
    expect(types).toContain("discoveryHandle: string");
    expect(types).not.toMatch(/asset_id:\s*string;\s*providerKind/);
  });

  it("forbids raw Ollama port 11434, /api/tags|show|generate, or EXPO_PUBLIC_*OLLAMA* in client code and config", () => {
    const root = join(process.cwd());
    const clientDirs = ["app", "components", "features", "lib", "hooks", "constants"];
    const clientFiles = clientDirs.flatMap((dir) => {
      try {
        return sourceFiles(join(root, dir));
      } catch {
        return [];
      }
    });

    const violations = clientFiles.flatMap((filePath) => {
      const text = readFileSync(filePath, "utf8");
      if (
        /11434|\/api\/(?:tags|show|generate|chat)|EXPO_PUBLIC_[A-Z0-9_]*OLLAMA/i.test(text)
      ) {
        return [relative(root, filePath)];
      }
      return [];
    });
    expect(violations).toEqual([]);

    const envExample = readFileSync(join(root, ".env.example"), "utf8");
    expect(envExample).not.toMatch(/EXPO_PUBLIC_[A-Z0-9_]*OLLAMA/i);
    expect(envExample).not.toContain("11434");
  });
});
