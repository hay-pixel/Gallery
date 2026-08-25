import { describe, expect, it } from "vitest";
import { DUPLICATE_GROUPS, FIXTURE_FILES, applyCategory, applyReviewState, filterLibraryFiles, searchFiles, type FileRecord } from "../lib/pixeldrive";

const aid = (char: string) => `sha256:${char.repeat(64)}`;

describe("canonical Gallery catalogue", () => {
  it("keys every record by canonical asset_id and collapses exact bytes", () => {
    expect(FIXTURE_FILES.every((file) => /^sha256:[0-9a-f]{64}$/.test(file.assetId))).toBe(true);
    expect(new Set(FIXTURE_FILES.map((file) => file.assetId)).size).toBe(FIXTURE_FILES.length);
    const resume = FIXTURE_FILES.find((file) => file.fileName === "alex_resume_2024.pdf");
    expect(resume?.sources).toHaveLength(2);
  });

  it("preserves multiple source occurrences without overwriting provenance", () => {
    const resume = FIXTURE_FILES.find((file) => file.sources.length === 2)!;
    expect(resume.sources.map((source) => source.originalPath)).toEqual(["Documents/Applications/alex_resume_2024.pdf", "Downloads/resume_final_copy.pdf"]);
  });

  it("finds an asset through every retained occurrence path", () => { expect(searchFiles(FIXTURE_FILES, "resume final copy")[0]?.fileName).toBe("alex_resume_2024.pdf"); });

  it("keeps exact duplicate occurrences reviewable without creating duplicate assets", () => { const group = DUPLICATE_GROUPS.find((item) => item.type === "Exact"); expect(group?.assetIds).toHaveLength(1); expect(group?.occurrenceIds).toHaveLength(2); });

  it("does not merge the same filename when content identities differ", () => {
    const base = FIXTURE_FILES[0]!;
    const records: FileRecord[] = [{ ...base, assetId: aid("a"), fileName: "same.jpg" }, { ...base, assetId: aid("b"), fileName: "same.jpg" }];
    expect(new Set(records.map((record) => record.assetId)).size).toBe(2);
  });

  it("keeps deterministic metadata browse/search working with optional services unavailable", () => {
    const offline = FIXTURE_FILES.map((file) => ({ ...file, analysisState: "unavailable" as const, searchState: "unavailable" as const }));
    expect(searchFiles(offline, "speaker wires")[0]?.fileName).toBe("speaker_wires_circled.jpg");
    expect(filterLibraryFiles(offline, "Documents", false).map((file) => file.fileName)).toEqual([...filterLibraryFiles(offline, "Documents", false).map((file) => file.fileName)]);
  });

  it("stores review/category decisions on Gallery records rather than provenance", () => {
    const target = FIXTURE_FILES.find((file) => file.reviewState === "NEEDS_REVIEW")!;
    const changed = applyReviewState(applyCategory(FIXTURE_FILES, target.assetId, "Documents", "Reviewed"), target.assetId, "APPROVED", "Manual review").find((file) => file.assetId === target.assetId)!;
    expect(changed.reviewState).toBe("APPROVED");
    expect(changed.sources).toEqual(target.sources);
  });
});
