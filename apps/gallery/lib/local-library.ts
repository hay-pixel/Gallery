export type LibraryEntry = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: number;
  sourceId: string;
  sourceName: string;
  origin: "phone" | "drive";
  uri?: string;
  relativePath?: string;
  description?: string;
  webViewLink?: string;
  driveSourceId?: number;
  thumbnailGrant?: string;
  mediaGrant?: string;
};
export type PhoneFolder = {
  uri: string;
  name: string;
  lastScan?: string;
  status?: string;
};
export type SortOrder = "Name" | "Date" | "Size" | "Type";
export const entryKey = (entry: LibraryEntry) =>
  JSON.stringify([entry.origin, entry.sourceId, entry.id]);
export const parseTags = (text: string) => {
  const seen = new Set<string>();
  return text
    .split(",")
    .map((t) => t.trim())
    .filter((t) => {
      const key = t.toLocaleLowerCase();
      if (!t || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50);
};
export function mergeFolderScan(
  previous: LibraryEntry[],
  sourceId: string,
  scanned: LibraryEntry[],
  complete: boolean,
) {
  const found = new Set(scanned.map(entryKey));
  return [
    ...previous.filter(
      (item) =>
        item.sourceId !== sourceId || (!complete && !found.has(entryKey(item))),
    ),
    ...scanned,
  ];
}
export function filterAndSort(
  entries: LibraryEntry[],
  query: string,
  source: string,
  sort: SortOrder,
  tags: Record<string, string[]>,
  tag = "",
) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries
    .filter((e) => {
      const saved = tags[entryKey(e)] ?? [];
      const corpus = [
        e.name,
        e.description,
        e.relativePath,
        e.sourceName,
        e.mimeType,
        ...saved,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (source === "All" || e.origin === source) &&
        (tag === "" || saved.includes(tag)) &&
        terms.every((t) => corpus.includes(t))
      );
    })
    .sort((a, b) => {
      const tie =
        a.name.localeCompare(b.name) || entryKey(a).localeCompare(entryKey(b));
      if (sort === "Date")
        return (b.modifiedTime ?? 0) - (a.modifiedTime ?? 0) || tie;
      if (sort === "Size") return (b.size ?? 0) - (a.size ?? 0) || tie;
      if (sort === "Type") return a.mimeType.localeCompare(b.mimeType) || tie;
      return tie;
    });
}
