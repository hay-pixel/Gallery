# Ollama Contract

## Purpose

Ollama is the permanent local reasoning, query interpretation, embedding, tool orchestration, and optional web research boundary. Other project components should call project-owned operations under `services/ollama`, not scatter raw Ollama HTTP payloads across Gallery, Search, Assist, or future services.

Ollama is an approved runtime component. ChatGPT, Manus, Codex, Gemini, and other build agents are not.

## Runtime Position

```text
Search or approved asset lookup results + canonical metadata + analysis records
  -> Ollama interpretation / reasoning / tools
  -> grounded answer with supporting asset IDs
  -> Gallery or Assist surface
```

Ollama enriches retrieval and reasoning. It does not replace canonical asset identity, ingest, primary visual analysis, deterministic Search, or Search-owned visual indexes.

## Service Boundary

Project-level operations should include only what the product needs:

- `health()`
- `models()`
- `capabilities(model_id)`
- `embed(input, profile)`
- `interpret_query(query, context)`
- `plan_retrieval(query, available_tools)`
- `reason_over_assets(question, asset_context)`
- `tool_call(tool_name, arguments)`
- `answer_with_grounding(question, retrieved_assets, optional_web_context)`

These are boundary concepts. Implementation can start smaller, but consumers must not depend on raw Ollama request/response wire formats.

## Local Runtime Privacy

- Local Ollama inference should bind privately, normally `127.0.0.1:11434` on the VM.
- Raw `127.0.0.1:11434` must not become a public product endpoint.
- Browser/mobile clients must not receive private runtime credentials, raw Ollama host URLs, or web-search API keys.
- Public-facing clients call the project application/API, which calls the Ollama service server-side.

## Responsibilities

Ollama may own:

- natural-language interpretation
- query planning
- reasoning over retrieved canonical asset context
- semantic embeddings when an approved local model is selected
- tool calling through server-controlled tools
- retrieval orchestration across Search operations
- secondary vision only as an optional enrichment
- optional server-side web search/fetch

Ollama must not own:

- canonical `asset_id`
- source occurrence identity
- ingest validation/extraction
- primary visual-analysis contract
- deterministic Search
- visual-similarity index ownership
- Gallery fixture identity
- production dependency on build-agent APIs

## Grounded Answer Contract

Answers about the archive must return:

```json
{
  "answer": "Short grounded response.",
  "supporting_assets": [
    {
      "asset_id": "sha256:...",
      "relationship": "evidence",
      "matched_metadata": ["analysis.tags:car", "ocr:fuel"],
      "analysis_id": "analysis:logical:...",
      "analysis_result_id": "analysis-result:...",
      "evidence_source": "search",
      "source_occurrences": [
        {
          "source_occurrence_id": "occurrence:sha256:...",
          "source_id": "source:sha256:...",
          "original_path": "camera/IMG_001.jpg"
        }
      ],
      "confidence": 0.78
    }
  ],
  "limitations": [
    "Only 12 assets had completed OCR."
  ],
  "web_context": [
    {
      "source": "web",
      "url": "https://example.invalid",
      "used_for": "background only",
      "local_asset_truth": false
    }
  ]
}
```

If no supporting assets exist, the system must say so. Ollama must not invent asset IDs or cite assets that were not returned by an approved project-owned retrieval or lookup tool. When it cites a specific terminal Analysis payload, it must preserve exact `result_id` provenance and should also include logical `analysis_id` when available.

Grounded evidence may come from:

- Search;
- `get_asset`;
- `get_asset_provenance`;
- `get_analysis`.

A direct question about a known canonical `asset_id` may use `get_asset`, `get_asset_provenance`, and `get_analysis` without making a synthetic Search call. The answer must still identify the lookup tool source and must not invent missing metadata, provenance, analysis, or asset evidence.

## Tool Model

Ollama tool access is server-controlled. Candidate tools:

- `search_metadata`
- `search_semantic`
- `find_visually_similar`
- `get_asset`
- `get_asset_provenance`
- `get_analysis`
- `get_search_state`
- `optional_web_search`
- `optional_web_fetch`

Tools must enforce:

- allowed argument schemas
- timeouts
- result limits
- no arbitrary filesystem access
- no arbitrary shell execution
- no browser/mobile secret exposure
- audit logging of tool name, inputs, result count, and error class

## Query Routing

Not every request goes through Ollama.

| Query | Route |
|---|---|
| `show images tagged car` | deterministic Search |
| `mime:image/jpeg from camera folder` | deterministic Search |
| `find pictures that look like this one` | visual Search |
| `show photos of the red car near the beach` | Ollama interpretation if needed, then semantic/hybrid Search |
| `what do these photos suggest happened?` | Search retrieval or approved direct lookup, then Ollama reasoning over grounded assets |
| `what is this random web claim about the location?` | optional web research, clearly separated from local evidence |

Gallery can call Search directly for deterministic operations.

## Web Search / Fetch

Optional Ollama-hosted web search/fetch is a separate capability from local inference.

Requirements:

- `OLLAMA_API_KEY` is server-side only.
- The key is never committed, logged, returned to clients, or embedded in Gallery/mobile code.
- Telemetry distinguishes local inference from hosted web calls.
- Gallery still works when web functionality is unavailable.
- Web information is enrichment, not canonical asset truth.
- Web context must be labelled separately from local archive evidence.

## Availability Rules

- Ollama offline: deterministic Search and basic Gallery browsing continue.
- Missing model: return a clear `model_unavailable` error with required capability and configured model ID.
- Embedding model unavailable: semantic indexing/search reports unavailable; metadata and visual Search can continue.
- Tool error: return partial grounded result with limitations when safe.
- Context too large: reduce retrieved context deterministically and report truncation.
- Web unavailable: omit web enrichment and continue local answer when possible.

## Prohibited Runtime Paths

- Ollama -> Manus as a production path
- Ollama -> ChatGPT Work as a production path
- Ollama -> Codex Cloud as a production path
- raw Ollama API exposed to public clients
- arbitrary filesystem or shell tools exposed through model tool calling
- hosted web results mixed into local asset evidence without labelling
