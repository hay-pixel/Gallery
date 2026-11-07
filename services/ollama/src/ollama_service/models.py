"""Project-owned contracts for Ollama inference, query planning, and grounded answers.

Conforms strictly to docs/contracts/OLLAMA.md and docs/contracts/QUERY.md.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Any, Literal

HASH_PATTERN = re.compile(r"^sha256:[0-9a-f]{64}$")
IntentType = Literal[
    "browse",
    "metadata_filter",
    "exact_identity",
    "visual_similarity",
    "semantic_discovery",
    "hybrid_discovery",
    "archive_reasoning",
    "web_enrichment",
]
CombineSemantics = Literal[
    "single_operation",
    "filter_then_rank",
    "intersection",
    "union",
    "dependency",
]


class OllamaContractError(ValueError):
    """Raised when an input or output violates the Ollama contract."""


class OllamaUnavailableError(RuntimeError):
    """Raised when the private Ollama runtime cannot be reached."""


class ModelUnavailableError(RuntimeError):
    """Raised when a requested model is not installed or available."""


def utc_now() -> str:
    """Return an RFC 3339 UTC timestamp."""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def check_hash(value: str, field_name: str = "asset_id") -> None:
    if not HASH_PATTERN.fullmatch(value):
        raise OllamaContractError(f"{field_name} must be an algorithm-qualified SHA-256 value (sha256:<64 hex>)")


@dataclass(frozen=True)
class OllamaHealth:
    reachable: bool
    status: Literal["available", "unavailable", "degraded"]
    host: str = "http://127.0.0.1:11434"
    version: str | None = None
    latency_ms: float | None = None
    error_message: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ModelInfo:
    name: str
    modified_at: str | None = None
    size_bytes: int = 0
    digest: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class ModelCapabilities:
    model_id: str
    supports_completion: bool = True
    supports_chat: bool = True
    supports_embeddings: bool = False
    supports_tools: bool = True
    supports_vision: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class QueryOperation:
    id: str
    tool: str
    arguments: Mapping[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "tool": self.tool,
            "arguments": dict(self.arguments),
        }


@dataclass(frozen=True)
class CombineStrategy:
    strategy: CombineSemantics
    primary_operation: str | None = None
    semantics: str | None = None
    depends_on: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        res: dict[str, Any] = {"strategy": self.strategy}
        if self.primary_operation is not None:
            res["primary_operation"] = self.primary_operation
        if self.semantics is not None:
            res["semantics"] = self.semantics
        if self.depends_on:
            res["depends_on"] = list(self.depends_on)
        return res


@dataclass(frozen=True)
class QueryPlan:
    intent: IntentType
    requires_ollama: bool
    operations: tuple[QueryOperation, ...]
    combine: CombineStrategy
    grounding_required: bool
    web_allowed: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "intent": self.intent,
            "requires_ollama": self.requires_ollama,
            "operations": [op.to_dict() for op in self.operations],
            "combine": self.combine.to_dict(),
            "grounding_required": self.grounding_required,
            "web_allowed": self.web_allowed,
        }


@dataclass(frozen=True)
class SourceOccurrenceEvidence:
    source_occurrence_id: str
    source_id: str
    original_path: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SupportingAsset:
    asset_id: str
    relationship: str
    matched_metadata: tuple[str, ...] = ()
    analysis_id: str | None = None
    analysis_result_id: str | None = None
    evidence_source: str = "search"
    source_occurrences: tuple[SourceOccurrenceEvidence, ...] = ()
    confidence: float = 1.0

    def __post_init__(self) -> None:
        check_hash(self.asset_id, "asset_id")

    def to_dict(self) -> dict[str, Any]:
        return {
            "asset_id": self.asset_id,
            "relationship": self.relationship,
            "matched_metadata": list(self.matched_metadata),
            "analysis_id": self.analysis_id,
            "analysis_result_id": self.analysis_result_id,
            "evidence_source": self.evidence_source,
            "source_occurrences": [s.to_dict() for s in self.source_occurrences],
            "confidence": round(self.confidence, 4),
        }


@dataclass(frozen=True)
class WebContext:
    source: Literal["web"] = "web"
    url: str = ""
    used_for: str = "background only"
    local_asset_truth: bool = False

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class GroundedAnswer:
    answer: str
    supporting_assets: tuple[SupportingAsset, ...] = ()
    limitations: tuple[str, ...] = ()
    web_context: tuple[WebContext, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "answer": self.answer,
            "supporting_assets": [a.to_dict() for a in self.supporting_assets],
            "limitations": list(self.limitations),
            "web_context": [w.to_dict() for w in self.web_context],
        }


@dataclass(frozen=True)
class AssetContext:
    """Retrieved or looked-up canonical asset context provided for reasoning."""

    asset_id: str
    original_path: str = ""
    mime_type: str = "image/jpeg"
    size_bytes: int = 0
    category: str = "Photos"
    subcategory: str | None = None
    tags: tuple[str, ...] = ()
    ocr_text: str = ""
    summary: str = ""
    analysis_id: str | None = None
    analysis_result_id: str | None = None
    evidence_source: str = "search"
    source_occurrences: tuple[SourceOccurrenceEvidence, ...] = ()

    def __post_init__(self) -> None:
        check_hash(self.asset_id, "asset_id")
