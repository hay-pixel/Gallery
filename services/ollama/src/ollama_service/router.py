"""Query router and execution planner.

Conforms strictly to docs/contracts/QUERY.md:
Decides whether a user request should use deterministic Search, visual similarity,
semantic retrieval, Ollama reasoning, or a combination.
"""

from __future__ import annotations

import re
from typing import Any

from .models import (
    CombineStrategy,
    OllamaContractError,
    QueryOperation,
    QueryPlan,
)

HASH_MATCH = re.compile(r"sha256:[0-9a-f]{64}", re.IGNORECASE)
MIME_PATTERNS = re.compile(r"(mime:[a-z0-9_\-\./]+|image/jpeg|image/png|video/mp4|application/pdf)", re.IGNORECASE)
TAG_PATTERNS = re.compile(r"(tag:[a-z0-9_\-]+|tagged\s+[a-z0-9_\-]+)", re.IGNORECASE)
REASONING_PATTERNS = re.compile(
    r"(what\s+(do|does|is|are|happened)|why\s+|how\s+|summarise|summarize|explain|tell\s+me\s+about|suggest|relationship)",
    re.IGNORECASE,
)
VISUAL_PATTERNS = re.compile(
    r"(looks\s+like|visually\s+similar|similar\s+to|near\s+duplicate)",
    re.IGNORECASE,
)
DUPLICATE_PATTERNS = re.compile(
    r"(duplicate|copies|redundant|wasted\s+space)",
    re.IGNORECASE,
)


class QueryRouter:
    """Interprets natural language queries into deterministic or AI query plans."""

    def plan(self, query: str, *, context: dict[str, Any] | None = None) -> QueryPlan:
        clean = query.strip()
        if not clean:
            raise OllamaContractError("Query must not be empty")

        # 1. Exact Identity Route (direct hash)
        hash_match = HASH_MATCH.search(clean)
        if hash_match:
            asset_id = hash_match.group(0).lower()
            return QueryPlan(
                intent="exact_identity",
                requires_ollama=False,
                operations=(
                    QueryOperation(
                        id="lookup_exact_asset",
                        tool="get_asset",
                        arguments={"asset_id": asset_id},
                    ),
                ),
                combine=CombineStrategy(strategy="single_operation", primary_operation="lookup_exact_asset"),
                grounding_required=False,
            )

        # 2. Visual Similarity Route
        if VISUAL_PATTERNS.search(clean) and context and "seed_asset_id" in context:
            seed_id = str(context["seed_asset_id"])
            return QueryPlan(
                intent="visual_similarity",
                requires_ollama=False,
                operations=(
                    QueryOperation(
                        id="visual_similarity_op",
                        tool="find_visually_similar",
                        arguments={"asset_id": seed_id, "limit": 20},
                    ),
                ),
                combine=CombineStrategy(strategy="single_operation", primary_operation="visual_similarity_op"),
                grounding_required=False,
            )

        # 3. Deterministic Metadata Filters (MIME, tags, categories)
        mime_match = MIME_PATTERNS.search(clean)
        tag_match = TAG_PATTERNS.search(clean)
        if (mime_match or tag_match) and not REASONING_PATTERNS.search(clean):
            filters: dict[str, Any] = {}
            if mime_match:
                raw_mime = mime_match.group(0).replace("mime:", "").strip()
                filters["mime_type"] = raw_mime
            if tag_match:
                raw_tag = tag_match.group(0).replace("tag:", "").replace("tagged", "").strip()
                filters["tag"] = raw_tag

            return QueryPlan(
                intent="metadata_filter",
                requires_ollama=False,
                operations=(
                    QueryOperation(
                        id="metadata_filter_op",
                        tool="search_metadata",
                        arguments={"filters": filters, "limit": 50},
                    ),
                ),
                combine=CombineStrategy(strategy="single_operation", primary_operation="metadata_filter_op"),
                grounding_required=False,
            )

        # 4. Duplicate Check Route
        if DUPLICATE_PATTERNS.search(clean) and not REASONING_PATTERNS.search(clean):
            return QueryPlan(
                intent="metadata_filter",
                requires_ollama=False,
                operations=(
                    QueryOperation(
                        id="duplicate_search_op",
                        tool="search_metadata",
                        arguments={"query": "duplicate", "limit": 50},
                    ),
                ),
                combine=CombineStrategy(strategy="single_operation", primary_operation="duplicate_search_op"),
                grounding_required=False,
            )

        # 5. Archive Reasoning Route (Requires Ollama + Grounded Evidence)
        if REASONING_PATTERNS.search(clean):
            return QueryPlan(
                intent="archive_reasoning",
                requires_ollama=True,
                operations=(
                    QueryOperation(
                        id="retrieval_for_reasoning",
                        tool="search_metadata",
                        arguments={"query": clean, "limit": 10},
                    ),
                ),
                combine=CombineStrategy(
                    strategy="single_operation",
                    primary_operation="retrieval_for_reasoning",
                    semantics="filter_then_rank",
                ),
                grounding_required=True,
                web_allowed=False,
            )

        # 6. Default: Hybrid / Semantic Discovery
        return QueryPlan(
            intent="semantic_discovery",
            requires_ollama=False,
            operations=(
                QueryOperation(
                    id="search_discovery",
                    tool="search_metadata",
                    arguments={"query": clean, "limit": 50},
                ),
            ),
            combine=CombineStrategy(strategy="single_operation", primary_operation="search_discovery"),
            grounding_required=False,
            web_allowed=False,
        )
