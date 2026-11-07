import type { ReviewState } from "../pixeldrive";
import type { CatalogueAssetView } from "./types";

export type CatalogueBrowseFilters = {
  mimePrefix?: string;
  category?: string;
  sourceId?: string;
  reviewState?: ReviewState;
  showSidecars?: boolean;
};

export type CatalogueBrowseSort = "display_name_asc" | "size_desc" | "asset_id_asc";

function normaliseText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildBrowseCorpus(view: CatalogueAssetView): string {
  const parts: string[] = [
    view.displayName,
    view.asset.mime_type,
    view.annotations.category ?? "",
    view.annotations.subcategory ?? "",
    view.annotations.userNotes ?? "",
    view.annotations.labels.join(" "),
    view.analysis?.tags.map((t) => t.tag).join(" ") ?? "",
    view.analysis?.ocr_text ?? "",
    view.analysis?.visual_description ?? "",
    view.occurrences
      .map((occ) => [occ.original_path, occ.source_location, occ.source_id].join(" "))
      .join(" "),
  ];
  return normaliseText(parts.join(" "));
}

export function browseCatalogue(
  assets: readonly CatalogueAssetView[],
  query: string = "",
  filters: CatalogueBrowseFilters = {},
  sort: CatalogueBrowseSort = "display_name_asc",
): CatalogueAssetView[] {
  const normalizedQuery = normaliseText(query);
  const terms = normalizedQuery ? normalizedQuery.split(" ").filter(Boolean) : [];

  const matched = assets.filter((view) => {
    if (filters.showSidecars === false && view.annotations.isTechnicalSidecar) {
      return false;
    }
    if (filters.mimePrefix && !view.asset.mime_type.startsWith(filters.mimePrefix)) {
      return false;
    }
    if (
      filters.category &&
      filters.category !== "All" &&
      view.annotations.category !== filters.category
    ) {
      return false;
    }
    if (
      filters.sourceId &&
      !view.occurrences.some((occ) => occ.source_id === filters.sourceId)
    ) {
      return false;
    }
    if (filters.reviewState && view.annotations.reviewState !== filters.reviewState) {
      return false;
    }
    if (terms.length > 0) {
      const corpus = buildBrowseCorpus(view);
      return terms.every((term) => corpus.includes(term));
    }
    return true;
  });

  const cloned = matched.map((view) => structuredClone(view));

  cloned.sort((a, b) => {
    if (sort === "size_desc") {
      return (
        b.asset.size_bytes - a.asset.size_bytes ||
        a.displayName.localeCompare(b.displayName) ||
        a.asset.asset_id.localeCompare(b.asset.asset_id)
      );
    }
    if (sort === "asset_id_asc") {
      return a.asset.asset_id.localeCompare(b.asset.asset_id);
    }
    return (
      a.displayName.localeCompare(b.displayName) ||
      a.asset.asset_id.localeCompare(b.asset.asset_id)
    );
  });

  return cloned;
}
