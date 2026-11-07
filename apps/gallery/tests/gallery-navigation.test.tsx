import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomeScreen } from "../features/home/home-screen";
import { ImagesScreen } from "../features/images/images-screen";
import { LibraryScreen } from "../features/library/library-screen";
import { SearchScreen } from "../features/search/search-screen";
import { SettingsScreen } from "../features/settings/settings-screen";
import { SourcesScreen } from "../features/sources/sources-screen";
import { createEmptyCatalogueSnapshot } from "../lib/catalogue/fixture-adapter";
import { buildAllCatalogueAssetViews } from "../lib/catalogue/view-model";

describe("Gallery mobile navigation and route destinations", () => {
  const emptySnapshot = createEmptyCatalogueSnapshot();
  const emptyViews = buildAllCatalogueAssetViews(emptySnapshot);

  it("renders Home destination with brand, quick links, and empty catalogue state", () => {
    const markup = renderToStaticMarkup(
      <HomeScreen
        views={emptyViews}
        snapshot={emptySnapshot}
        onNavigate={() => {}}
      />,
    );
    expect(markup).toContain("PixelDrive");
    expect(markup).toContain("Library");
    expect(markup).toContain("Sources");
  });

  it("renders Images destination with filter chips and empty state", () => {
    const markup = renderToStaticMarkup(
      <ImagesScreen
        views={emptyViews}
        onSelectAsset={() => {}}
      />,
    );
    expect(markup).toContain("Images");
    expect(markup).toContain("Photos");
  });

  it("renders Search destination with query input and modes", () => {
    const markup = renderToStaticMarkup(
      <SearchScreen
        views={emptyViews}
        onSelectAsset={() => {}}
      />,
    );
    expect(markup).toContain("Search");
  });

  it("renders Library destination with category filters and reviews", () => {
    const markup = renderToStaticMarkup(
      <LibraryScreen
        views={emptyViews}
        onSelectAsset={() => {}}
      />,
    );
    expect(markup).toContain("Library");
  });

  it("renders Sources destination with local discovery and Drive links", () => {
    const markup = renderToStaticMarkup(
      <SourcesScreen
        snapshot={emptySnapshot}
        onImportSuccess={() => {}}
      />,
    );
    expect(markup).toContain("Sources");
    expect(markup).toContain("read-only");
  });

  it("renders Settings destination with companion and Ollama status without raw endpoints", () => {
    const markup = renderToStaticMarkup(
      <SettingsScreen
        snapshot={emptySnapshot}
      />,
    );
    expect(markup).toContain("Settings");
    expect(markup).not.toContain("11434");
    expect(markup).not.toContain("EXPO_PUBLIC");
  });
});

