import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssetCard } from "../components/catalogue/asset-card";
import { ImagesScreen } from "../features/images/images-screen";
import { snapshotFromFixtures } from "../lib/catalogue/fixture-adapter";
import { buildAllCatalogueAssetViews } from "../lib/catalogue/view-model";

const preview = "data:image/png;base64,iVBORw0KGgo=";
function imageView(uri: string) {
  const view = buildAllCatalogueAssetViews(snapshotFromFixtures(true))[0];
  view.annotations.previewDataUri = uri;
  return view;
}
describe("imported image previews", () => {
  it("renders the supplied image bytes in library cards and Images", () => {
    const view = imageView(preview);
    expect(renderToStaticMarkup(<AssetCard view={view} />)).toContain(preview);
    expect(renderToStaticMarkup(<ImagesScreen views={[view]} />)).toContain(
      preview,
    );
  });
  it("does not load remote or host filesystem URLs from metadata", () => {
    for (const unsafe of [
      "https://unapproved.example/image.jpg",
      "file:///private/a.jpg",
    ]) {
      expect(
        renderToStaticMarkup(<AssetCard view={imageView(unsafe)} />),
      ).not.toContain(unsafe);
    }
  });
});
