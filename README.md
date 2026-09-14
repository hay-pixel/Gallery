# Gallery

Gallery is a standalone universal file library and discovery application.

Its primary job is to connect to authorised file sources, catalogue their contents without requiring physical reorganisation, enrich those assets with metadata and intelligence, and give the user one place to browse, search, review and ask questions across everything they own.

Gallery is useful on its own. It must not require Extractor or Assist to connect sources and provide its core library experience.

## Core responsibilities

- Connect to multiple authorised sources such as Google Drive, OneDrive and local/device storage.
- Treat each source as a peer. Extractor output is only one possible source.
- Preserve source identity, original location and provenance.
- Maintain a unified catalogue across sources without assuming one physical folder structure.
- Detect exact duplicates and likely visual duplicates as relationships, not automatic deletions.
- Run or consume visual analysis, OCR, tags, descriptions and similarity metadata.
- Provide metadata, semantic and visual search.
- Use Ollama as a local reasoning and retrieval layer where configured, without making raw Ollama access a public dependency.
- Support browsing, categories, albums/views, review workflows, similar items and conversational discovery.
- Preserve user corrections and overrides across re-analysis.

## Optional interoperability

Gallery may index files produced by Extractor and may be maintained through Assist, but neither application is part of Gallery's runtime contract.

## Independence rule

Gallery must build, install, run, connect at least one authorised storage source and provide a usable library with neither Extractor nor Assist installed.

## Migration sources

Evidence must be reviewed before migration. Important source lineages include:

- `hay-pixel/Pixeldrive` (`main`)
- `hay-pixel/Privatedrive`
- relevant Gallery, analysis, search and Ollama work in `hay-pixel/Ollamabinsaden`

Do not rebuild Gallery around Extractor output. The source model is connector -> source occurrence -> canonical asset/catalogue record, with multiple providers treated as first-class sources.
