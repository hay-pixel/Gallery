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
    const screen = readFileSync(join(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
    expect(screen).toContain("type DriveFile = { id: string");
    expect(screen).toContain("type FileRecord");
    expect(screen).not.toMatch(/assetId:\s*file\.id/);
  });
});
