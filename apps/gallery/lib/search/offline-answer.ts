import { browseCatalogue } from "../catalogue/browse";
import type { CatalogueAssetView } from "../catalogue/types";

export function offlineArchiveAnswer(
  views: CatalogueAssetView[],
  query: string,
) {
  const matches = browseCatalogue(views, query).slice(0, 20);
  return {
    offline: true,
    answer: matches.length
      ? `AI is unavailable. Found ${matches.length} matching item${matches.length === 1 ? "" : "s"} in your saved library.`
      : "AI is unavailable. No matching items were found in your saved library. Try a filename or keyword in Catalogue browse.",
    supporting_assets: matches.map((view) => ({
      asset_id: view.asset.asset_id,
    })),
    limitations: ["Local text matching only. No AI answer was generated."],
  };
}
