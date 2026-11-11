import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocalSourceBrowser } from "../features/sources/local-source-browser";
import { SourcesScreen } from "../features/sources/sources-screen";
import { createEmptyCatalogueSnapshot } from "../lib/catalogue/fixture-adapter";

describe("Gallery sources and discovery UI", () => {
  it("renders permission states and source-only items without minting asset_id", () => {
    const deniedMarkup = renderToStaticMarkup(
      <LocalSourceBrowser
        accessState="denied"
        items={[]}
        onClose={() => {}}
        onPickDocument={() => {}}
      />,
    );
    expect(deniedMarkup).toContain("Media access not granted");

    const grantedMarkup = renderToStaticMarkup(
      <LocalSourceBrowser
        accessState="granted"
        items={[
          {
            discoveryHandle: "local_media:99",
            providerKind: "local_media",
            displayName: "IMG_99.JPG",
            uri: "content://media/external/images/media/99",
            mimeType: "image/jpeg",
            accessState: "granted",
          },
        ]}
        onClose={() => {}}
        onPickDocument={() => {}}
      />,
    );
    expect(grantedMarkup).toContain("IMG_99.JPG");
    expect(grantedMarkup).toContain("Source-only preview");
  });

  it("renders SourcesScreen with canonical import trigger and read-only Drive explanation", () => {
    const snapshot = createEmptyCatalogueSnapshot();
    const markup = renderToStaticMarkup(
      <SourcesScreen snapshot={snapshot} onImportSuccess={() => {}} />,
    );
    expect(markup).toContain("Connect Google Drive");
    expect(markup).toContain("Import collection");
    expect(markup).toMatch(/read-only/i);
  });
});
