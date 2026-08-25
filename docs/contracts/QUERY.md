# Query Contract

## Purpose

The query layer decides whether a user request should use deterministic Search, visual similarity, semantic retrieval, Ollama interpretation/reasoning, optional web research, or a combination. It prevents simple Gallery operations from becoming unnecessary LLM calls while still allowing natural-language reasoning when useful.

## Routing Principles

- Deterministic queries go directly to Search.
- Visual seed queries go to visual Search.
- Conceptual language queries may use Ollama to interpret intent and select Search tools.
- Reasoning questions use Ollama only after Search or an approved direct lookup returns grounded asset context.
- Optional web research is separate enrichment and never canonical asset truth.
- Search remains usable without Ollama.
- Gallery browsing remains usable without Search indexes or Ollama.

## Query Intent Types

| Intent | Examples | Primary route | Ollama required |
|---|---|---|---|
| Browse | open asset, list recent, show folder/source | canonical records / Search metadata | No |
| Metadata filter | MIME type, source, path, date, tag, status | Search metadata | No |
| Exact identity | asset ID, content hash, source occurrence | Search metadata / asset store / approved lookup | No |
| Visual similarity | looks like this, near duplicate candidate | Search visual similarity | No |
| Semantic discovery | beach photos, receipts mentioning fuel | Search semantic, optional query interpretation | Sometimes |
| Hybrid discovery | red car near beach from camera folder | Ollama interpretation then Search hybrid | Sometimes |
| Archive reasoning | what do these suggest, summarize this trip | Search or approved direct lookup then Ollama reasoning | Yes |
| Web enrichment | compare location/weather/public info | Optional web tools | Yes, if enabled |

## Query Plan Shape

A query plan should be explicit and auditable:

```json
{
  "intent": "hybrid_discovery",
  "requires_ollama": true,
  "operations": [
    {
      "id": "semantic_red_car_beach",
      "tool": "search_semantic",
      "arguments": {
        "text": "red car near beach",
        "filters": {"media_type": "image", "source_kind": "camera"},
        "limit": 50
      }
    }
  ],
  "combine": {
    "strategy": "single_operation",
    "primary_operation": "semantic_red_car_beach",
    "semantics": "filter_then_rank"
  },
  "grounding_required": true,
  "web_allowed": false
}
```

## Combination Semantics

Every multi-operation query plan must declare how operation results combine. Supported combination semantics are:

| Strategy | Meaning |
|---|---|
| `single_operation` | One operation already contains the complete executable request. Prefer this when deterministic filters can be pushed into semantic/hybrid retrieval. |
| `filter_then_rank` | Apply deterministic filters before vector or ranking work. Results that fail the filter are not candidates. |
| `intersection` | Keep only assets returned by all listed operations. |
| `union` | Combine assets returned by any listed operation, then rank with declared ranking rules. |
| `dependency` | Later operation consumes IDs or context from an earlier operation. |

For a query such as `source_kind=camera` plus semantic query `red car near beach`, prefer `single_operation` or `filter_then_rank` by passing `source_kind=camera` as a filter inside `search_semantic` or `search_hybrid`.

If multiple operations are required, the plan must be executable and unambiguous:

```json
{
  "intent": "hybrid_discovery",
  "operations": [
    {
      "id": "camera_filter",
      "tool": "search_metadata",
      "arguments": {
        "filters": {"source_kind": "camera"},
        "limit": 500
      }
    },
    {
      "id": "semantic_red_car_beach",
      "tool": "search_semantic",
      "arguments": {
        "text": "red car near beach",
        "candidate_asset_ids_from": "camera_filter",
        "limit": 50
      }
    }
  ],
  "combine": {
    "strategy": "dependency",
    "primary_operation": "semantic_red_car_beach",
    "depends_on": ["camera_filter"],
    "semantics": "filter_then_rank"
  },
  "grounding_required": true,
  "web_allowed": false
}
```

Plans must not leave callers guessing whether operations mean intersection, union, dependency, or filter-then-rank.

Paginated query operations must use this response envelope:

```json
{
  "results": [],
  "next_cursor": null
}
```

`next_cursor` is nullable and opaque.

## Grounding Rules

Ollama can only answer archive questions from:

- canonical asset records
- source occurrence records
- normalized analysis records, including exact `result_id` when terminal Analysis provenance matters
- Search results
- approved `get_asset`, `get_asset_provenance`, and `get_analysis` lookup results
- explicitly labelled optional web context

Ollama must not invent assets, source paths, tags, OCR text, or dates. If the retrieved evidence does not support an answer, the answer says that evidence is missing.

## Degradation Rules

| Condition | Expected behavior |
|---|---|
| Search index unavailable | Gallery browse uses canonical asset records; Search returns typed unavailable status |
| Visual index unavailable | Similar-item features disabled or marked unavailable |
| Semantic index unavailable | Natural-language concept search reports unavailable; deterministic filters continue |
| Ollama offline | Direct Search works; reasoning and query interpretation are unavailable |
| Model missing | Clear model/capability unavailable response |
| Analysis pending | Results expose pending state; no invented analysis |
| Analysis stale | Results expose stale state and stale reason |
| Web unavailable | Local archive answers continue without web enrichment |
| Embedding unavailable | Semantic index build/search pauses; metadata/visual can continue |

## Client Contract

Gallery should be able to consume:

- asset result lists
- similar-item result lists
- Search state and index availability
- analysis pending/stale/failed states
- grounded semantic/reasoned responses

Gallery must not know FAISS/HNSW internals, raw Ollama payloads, private hostnames, web-search secrets, or build-agent IDs.
