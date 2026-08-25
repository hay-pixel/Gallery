# Ollama Acceptance

## Scope

These checks evaluate the project-owned Ollama adapter and its integration with Search and Gallery. They do not require a specific local model until the implementation owner selects one behind the approved boundary.

## Architecture Gate

Ollama integration is acceptable only if:

- raw Ollama wire formats are hidden behind `services/ollama`;
- raw port `11434` is not exposed publicly;
- browser/mobile clients never receive runtime secrets;
- archive answers are grounded to real `asset_id` values returned by Search or approved project-owned lookup tools;
- deterministic Gallery/Search operations do not require Ollama;
- optional web research is clearly separated from local asset evidence;
- no ChatGPT, Manus, Codex Cloud, Gemini, or build-session runtime dependency is introduced.

## Acceptance Matrix

| Case | Expected behavior |
|---|---|
| deterministic query bypass | `show images tagged car` routes to Search metadata without requiring Ollama |
| natural-language routing | `red car near beach` becomes an auditable semantic/hybrid Search plan |
| grounded answer | answer includes supporting `asset_id` values and matched metadata/analysis |
| direct asset grounding | question about a known `asset_id` may use `get_asset`, `get_asset_provenance`, or `get_analysis` without a synthetic Search call |
| nonexistent asset | system says no supporting asset exists; no invented `asset_id` |
| Ollama offline | deterministic Search and Gallery browsing continue; reasoning reports unavailable |
| model unavailable | returns clear `model_unavailable` with capability and configured model ID |
| tool loop boundary | model can call only approved tools and cannot access filesystem/shell arbitrarily |
| web distinction | web results are labelled as web context, not local archive evidence |
| secret safety | `OLLAMA_API_KEY` and private hosts never appear in client responses |
| private endpoint | raw `127.0.0.1:11434` is not exposed as a public product endpoint |
| context truncation | large result sets are reduced predictably and limitations are returned |
| stale analysis | answer reports stale/pending analysis instead of treating it as fresh evidence |

## Grounding Checks

Every archive answer must be machine-checkable:

- supporting assets are listed by `asset_id`;
- each supporting asset came from Search, `get_asset`, `get_asset_provenance`, or `get_analysis`;
- matched fields or analysis snippets are included when relevant, with exact Analysis `result_id` when citing a terminal Analysis payload;
- source occurrence IDs are included when provenance matters;
- limitations are explicit when evidence is incomplete;
- no asset absent from approved retrieval/lookup output is cited.

## Tool Security Checks

Approved tools must:

- validate argument schemas;
- enforce result limits;
- enforce timeouts;
- return typed errors;
- log tool name and result count;
- avoid arbitrary filesystem and shell access;
- keep secrets server-side.

## Web Search Checks

- Local inference works without hosted web search.
- Hosted web calls require server-side `OLLAMA_API_KEY`.
- Web failures do not break Gallery or local Search.
- Web context is labelled as enrichment.
- Web context cannot overwrite canonical asset metadata.

## Degradation Checks

| Condition | Required response |
|---|---|
| Ollama service down | `ollama_unavailable`, deterministic Search still available |
| local model missing | `model_unavailable`, include required capability |
| embedding model missing | semantic embedding/index unavailable; metadata/visual continue |
| Search unavailable | reasoning cannot claim archive evidence; return limitation |
| web unavailable | answer from local evidence only or report web unavailable |
| tool denied | return safe partial response or typed denial |
