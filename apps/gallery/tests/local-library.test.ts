import { describe, expect, it } from "vitest";
import { formatBytes } from "../lib/pixeldrive";
import {
  mergeFolderScan,
  filterAndSort,
  parseTags,
  entryKey,
  type LibraryEntry,
} from "../lib/local-library";
const file = (id: string, name: string, size = 1): LibraryEntry => ({
  id,
  name,
  size,
  mimeType: "image/jpeg",
  sourceId: "folder-a",
  sourceName: "Camera",
  origin: "phone",
  uri: "content://local/" + id,
  modifiedTime: 1,
});
describe("phone index and annotations", () => {
  it("shows small phone file sizes accurately", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(693)).toBe("693 B");
  });
  it("removes deleted entries only after a complete scan and keeps other folders", () => {
    const other = { ...file("3", "other"), sourceId: "folder-b" };
    expect(
      mergeFolderScan(
        [file("1", "old"), file("2", "deleted"), other],
        "folder-a",
        [file("1", "new")],
        true,
      ).map((x) => x.name),
    ).toEqual(["other", "new"]);
    expect(
      mergeFolderScan(
        [file("1", "old"), file("2", "keep")],
        "folder-a",
        [file("1", "new")],
        false,
      ).map((x) => x.name),
    ).toEqual(["keep", "new"]);
  });
  it("keeps source identity distinct from canonical identity", () =>
    expect(entryKey(file("1", "a"))).not.toBe(
      entryKey({ ...file("1", "a"), sourceId: "folder-b" }),
    ));
  it("searches manual tags and source paths, with deterministic sorting", () => {
    const a = file("1", "a.jpg", 10),
      b = { ...file("2", "b.jpg", 20), relativePath: "Beach/b.jpg" };
    const tags = { [entryKey(a)]: ["Holiday"] };
    expect(
      filterAndSort([b, a], "holiday", "All", "Name", tags).map((x) => x.id),
    ).toEqual(["1"]);
    expect(
      filterAndSort([b, a], "beach", "All", "Name", tags).map((x) => x.id),
    ).toEqual(["2"]);
    expect(
      filterAndSort([a, b], "", "All", "Size", tags).map((x) => x.id),
    ).toEqual(["2", "1"]);
  });
  it("normalises tags without dropping user wording", () =>
    expect(parseTags("Car, car,  Beach , ,Beach")).toEqual(["Car", "Beach"]));
});
