"""Provider-independent contracts for persistent visual similarity Search."""

from __future__ import annotations

import hashlib
import json
import math
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal

HASH_PATTERN = re.compile(r"^sha256:[0-9a-f]{64}$")
RelationshipType = Literal["near_duplicate_candidate", "visually_similar"]
IndexState = Literal["ready", "empty", "rebuilding", "degraded"]


class SearchError(RuntimeError):
    """Base error raised by the Search service."""


class ContractError(SearchError, ValueError):
    """Raised when an input violates the public Search contract."""


class IndexUnavailableError(SearchError):
    """Raised when a requested profile has no usable visual index."""


class AssetNotIndexedError(SearchError):
    """Raised when a canonical asset has no usable vector for a profile."""


def utc_now() -> str:
    """Return an RFC 3339 UTC timestamp."""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _require_nonempty(value: str, field_name: str) -> None:
    if not value or not value.strip():
        raise ContractError(f"{field_name} must not be empty")


def _require_hash(value: str, field_name: str) -> None:
    if not HASH_PATTERN.fullmatch(value):
        raise ContractError(f"{field_name} must be an algorithm-qualified SHA-256 value")


def _normalise_vector(values: Sequence[float], dimensions: int) -> tuple[float, ...]:
    if len(values) != dimensions:
        raise ContractError("vector length must equal the feature profile dimensions")
    converted: list[float] = []
    for value in values:
        number = float(value)
        if not math.isfinite(number):
            raise ContractError("vector values must be finite numbers")
        converted.append(number)
    if not any(converted):
        raise ContractError("zero vectors cannot be compared using cosine similarity")
    return tuple(converted)


def _canonical_normalization(value: Mapping[str, Any]) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise ContractError("normalization must be an object")
    if set(value).difference({"kind", "applied"}):
        raise ContractError("normalization contains unsupported semantics")
    kind = value.get("kind")
    applied = value.get("applied")
    if not isinstance(kind, str) or not kind.strip():
        raise ContractError("normalization.kind must be a non-empty string")
    if not isinstance(applied, bool):
        raise ContractError("normalization.applied must be a boolean")
    return {"kind": kind, "applied": applied}


@dataclass(frozen=True)
class FeatureProfile:
    """The complete VisualFeature compatibility key for one isolated visual index."""

    feature_type: str
    feature_model_id: str
    feature_model_version: str
    feature_extractor_revision: str
    dimensions: int
    similarity_family: Literal["cosine"]
    normalization: Mapping[str, Any]

    def __post_init__(self) -> None:
        _require_nonempty(self.feature_type, "feature_type")
        _require_nonempty(self.feature_model_id, "feature_model_id")
        _require_nonempty(self.feature_model_version, "feature_model_version")
        _require_nonempty(self.feature_extractor_revision, "feature_extractor_revision")
        if self.dimensions < 1:
            raise ContractError("dimensions must be positive")
        if self.similarity_family != "cosine":
            raise ContractError("only the provider-independent cosine similarity family is supported")
        object.__setattr__(self, "normalization", _canonical_normalization(self.normalization))

    @property
    def dimension(self) -> int:
        """Internal convenience alias; the external contract field is ``dimensions``."""
        return self.dimensions

    @property
    def partition_key(self) -> str:
        """Stable hash of every required VisualFeature compatibility component."""
        payload = json.dumps(self.to_dict(), sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(payload.encode()).hexdigest()

    @property
    def index_id(self) -> str:
        return f"visual-index:sha256:{self.partition_key}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "feature_type": self.feature_type,
            "feature_model_id": self.feature_model_id,
            "feature_model_version": self.feature_model_version,
            "feature_extractor_revision": self.feature_extractor_revision,
            "dimensions": self.dimensions,
            "similarity_family": self.similarity_family,
            "normalization": dict(self.normalization),
        }


@dataclass(frozen=True)
class VisualFeatureInput:
    """Validated inline VisualFeature data from an authorised normalized boundary."""

    asset_id: str
    input_content_hash: str
    profile: FeatureProfile
    values: Sequence[float]
    feature_id: str
    analysis_id: str | None = None
    analysis_result_id: str | None = None
    schema: Literal["visual-feature"] = "visual-feature"
    schema_version: int = 1
    generated_at: str = field(default_factory=utc_now)

    def __post_init__(self) -> None:
        _require_hash(self.asset_id, "asset_id")
        _require_hash(self.input_content_hash, "input_content_hash")
        if self.asset_id != self.input_content_hash:
            raise ContractError("asset_id and input_content_hash must identify the same canonical bytes")
        _require_nonempty(self.feature_id, "feature_id")
        if self.schema != "visual-feature" or self.schema_version != 1:
            raise ContractError("only visual-feature schema version 1 is supported")
        if self.analysis_id is not None:
            _require_nonempty(self.analysis_id, "analysis_id")
        if self.analysis_result_id is not None:
            _require_nonempty(self.analysis_result_id, "analysis_result_id")
            if self.analysis_id is None:
                raise ContractError("analysis_id is required when analysis_result_id is supplied")
        _require_nonempty(self.generated_at, "generated_at")
        object.__setattr__(self, "values", _normalise_vector(self.values, self.profile.dimensions))

    @property
    def content_hash(self) -> str:
        """Canonical Search-result name for the verified VisualFeature input hash."""
        return self.input_content_hash

    @property
    def stable_feature_id(self) -> str:
        return self.feature_id


@dataclass(frozen=True)
class SimilarityResult:
    """Stable Search result that does not expose internal vector or database identities."""

    asset_id: str
    content_hash: str
    score: float
    relationship_type: RelationshipType
    profile: FeatureProfile
    index_version: str
    analysis_id: str | None = None
    analysis_result_id: str | None = None
    explanation: str | None = None

    def __post_init__(self) -> None:
        _require_hash(self.asset_id, "asset_id")
        _require_hash(self.content_hash, "content_hash")
        if not -1.0 <= self.score <= 1.0:
            raise ContractError("cosine similarity score must be between -1 and 1")
        if self.analysis_result_id is not None and self.analysis_id is None:
            raise ContractError("analysis_id is required when analysis_result_id is supplied")

    def to_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "asset_id": self.asset_id,
            "content_hash": self.content_hash,
            "score": round(self.score, 6),
            "score_kind": "cosine_similarity",
            "retrieval_mode": "visual_similarity",
            "relationship_type": self.relationship_type,
            "index_id": self.profile.index_id,
            "index_version": self.index_version,
            "model": self.profile.to_dict(),
        }
        if self.analysis_id is not None:
            value["analysis_id"] = self.analysis_id
        if self.analysis_result_id is not None:
            value["analysis_result_id"] = self.analysis_result_id
        if self.explanation is not None:
            value["explanation"] = {"summary": self.explanation, "deterministic": False}
        return value


@dataclass(frozen=True)
class AssetSearchState:
    """Availability and freshness state for one asset/profile pair."""

    asset_id: str
    profile: FeatureProfile
    state: Literal["indexed", "stale", "missing"]
    stale_reason: str | None = None
    indexed_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "asset_id": self.asset_id,
            "profile": self.profile.to_dict(),
            "state": self.state,
        }
        if self.stale_reason is not None:
            value["stale_reason"] = self.stale_reason
        if self.indexed_at is not None:
            value["indexed_at"] = self.indexed_at
        return value


@dataclass(frozen=True)
class IndexStatus:
    """Health summary for a rebuildable visual feature index partition."""

    profile: FeatureProfile
    state: IndexState
    active_vector_count: int
    stale_vector_count: int
    index_version: str
    updated_at: str
    storage_path: str
    detail: str | None = None

    def to_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "index_id": self.profile.index_id,
            "index_version": self.index_version,
            "profile": self.profile.to_dict(),
            "state": self.state,
            "active_vector_count": self.active_vector_count,
            "stale_vector_count": self.stale_vector_count,
            "updated_at": self.updated_at,
            "storage_path": self.storage_path,
        }
        if self.detail is not None:
            value["detail"] = self.detail
        return value


SearchFilters = Mapping[str, Sequence[str] | str]


@dataclass(frozen=True)
class SourceOccurrenceProvenance:
    """Structural source-occurrence provenance keeping path and occurrence attached."""

    source_occurrence_id: str
    source_id: str
    original_path: str
    source_kind: str | None = None
    source_location: str | None = None
    source_archive_id: str | None = None
    source_member: str | None = None

    def __post_init__(self) -> None:
        _require_nonempty(self.source_occurrence_id, "source_occurrence_id")
        _require_nonempty(self.source_id, "source_id")
        _require_nonempty(self.original_path, "original_path")

    def to_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "source_occurrence_id": self.source_occurrence_id,
            "source_id": self.source_id,
            "original_path": self.original_path,
        }
        if self.source_kind is not None:
            value["source_kind"] = self.source_kind
        if self.source_location is not None:
            value["source_location"] = self.source_location
        if self.source_archive_id is not None or self.source_member is not None:
            value["source_archive_id"] = self.source_archive_id
            value["source_member"] = self.source_member
        return value


@dataclass(frozen=True)
class MetadataDocumentInput:
    """Canonical asset metadata and normalized analysis fields for deterministic Search."""

    asset_id: str
    content_hash: str
    mime_type: str
    size_bytes: int
    original_path: str = ""
    source_kind: str = "local_folder"
    source_location: str = ""
    category: str = "Uncategorized"
    subcategory: str | None = None
    tags: Sequence[str] = ()
    categories: Sequence[str] = ()
    ocr_text: str = ""
    summary: str = ""
    analysis_status: str = "ready"
    analysis_id: str | None = None
    analysis_result_id: str | None = None
    source_occurrences: Sequence[SourceOccurrenceProvenance] = ()

    def __post_init__(self) -> None:
        _require_hash(self.asset_id, "asset_id")
        _require_hash(self.content_hash, "content_hash")
        if self.asset_id != self.content_hash:
            raise ContractError("asset_id and content_hash must identify the same canonical bytes")
        _require_nonempty(self.mime_type, "mime_type")
        if self.size_bytes < 0:
            raise ContractError("size_bytes must be non-negative")
        if self.analysis_result_id is not None and self.analysis_id is None:
            raise ContractError("analysis_id is required when analysis_result_id is supplied")
        object.__setattr__(self, "tags", tuple(str(t).strip().lower() for t in self.tags if str(t).strip()))
        object.__setattr__(
            self, "categories", tuple(str(c).strip() for c in self.categories if str(c).strip())
        )
        object.__setattr__(self, "source_occurrences", tuple(self.source_occurrences))


@dataclass(frozen=True)
class MatchedField:
    """Deterministic field match explanation."""

    field: str
    value: str
    match_type: Literal["exact", "substring", "range"] = "exact"
    confidence: float = 1.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "field": self.field,
            "value": self.value,
            "match_type": self.match_type,
            "confidence": round(self.confidence, 4),
        }


@dataclass(frozen=True)
class MetadataSearchResult:
    """Deterministic metadata Search result conforming to docs/contracts/SEARCH.md."""

    asset_id: str
    content_hash: str
    matched_fields: tuple[MatchedField, ...]
    source_occurrences: tuple[SourceOccurrenceProvenance, ...] = ()
    analysis_id: str | None = None
    analysis_result_id: str | None = None
    index_id: str = "metadata-index:v1"
    index_version: str = "metadata-index-v1"

    def __post_init__(self) -> None:
        _require_hash(self.asset_id, "asset_id")
        _require_hash(self.content_hash, "content_hash")

    def to_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "asset_id": self.asset_id,
            "content_hash": self.content_hash,
            "retrieval_mode": "metadata",
            "relationship_type": "metadata_match",
            "matched_fields": [m.to_dict() for m in self.matched_fields],
            "index_id": self.index_id,
            "index_version": self.index_version,
            "provenance": {
                "source_occurrences": [occ.to_dict() for occ in self.source_occurrences]
            },
        }
        if self.analysis_id is not None:
            value["analysis_id"] = self.analysis_id
        if self.analysis_result_id is not None:
            value["analysis_result_id"] = self.analysis_result_id
        return value


@dataclass(frozen=True)
class SearchPage:
    """Provider-independent paginated response envelope."""

    results: tuple[Any, ...]
    next_cursor: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "results": [r.to_dict() if hasattr(r, "to_dict") else r for r in self.results],
            "next_cursor": self.next_cursor,
        }


@dataclass(frozen=True)
class SemanticProfile:
    """Isolated compatibility key for a semantic text embedding partition."""

    model_id: str
    model_version: str
    dimension: int
    similarity_family: Literal["cosine"] = "cosine"
    family: Literal["semantic"] = "semantic"

    def __post_init__(self) -> None:
        _require_nonempty(self.model_id, "model_id")
        _require_nonempty(self.model_version, "model_version")
        if self.dimension < 1:
            raise ContractError("dimension must be positive")
        if self.similarity_family != "cosine":
            raise ContractError("only cosine similarity is supported for semantic profiles")
        if self.family != "semantic":
            raise ContractError("semantic profile family must be 'semantic'")

    @property
    def partition_key(self) -> str:
        payload = json.dumps(self.to_dict(), sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(payload.encode()).hexdigest()

    @property
    def index_id(self) -> str:
        return f"semantic-index:{self.model_id}:{self.model_version}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "family": self.family,
            "model_id": self.model_id,
            "model_version": self.model_version,
            "dimension": self.dimension,
        }


@dataclass(frozen=True)
class SemanticEmbeddingInput:
    """Validated semantic embedding derived from canonical asset text inputs."""

    asset_id: str
    content_hash: str
    profile: SemanticProfile
    values: Sequence[float]
    semantic_input_revision: str
    analysis_id: str | None = None
    analysis_result_id: str | None = None
    generated_at: str = field(default_factory=utc_now)

    def __post_init__(self) -> None:
        _require_hash(self.asset_id, "asset_id")
        _require_hash(self.content_hash, "content_hash")
        if self.asset_id != self.content_hash:
            raise ContractError("asset_id and content_hash must identify the same canonical bytes")
        _require_nonempty(self.semantic_input_revision, "semantic_input_revision")
        if self.analysis_result_id is not None and self.analysis_id is None:
            raise ContractError("analysis_id is required when analysis_result_id is supplied")
        object.__setattr__(self, "values", _normalise_vector(self.values, self.profile.dimension))


@dataclass(frozen=True)
class SemanticAssetSearchState:
    """Availability and freshness state for one asset/semantic-profile pair."""

    asset_id: str
    profile: SemanticProfile
    state: Literal["indexed", "stale", "missing"]
    stale_reason: str | None = None
    indexed_at: str | None = None

    def to_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "asset_id": self.asset_id,
            "profile": self.profile.to_dict(),
            "state": self.state,
        }
        if self.stale_reason is not None:
            value["stale_reason"] = self.stale_reason
        if self.indexed_at is not None:
            value["indexed_at"] = self.indexed_at
        return value


@dataclass(frozen=True)
class SemanticSearchResult:
    """Semantic Search result conforming to docs/contracts/SEARCH.md."""

    asset_id: str
    content_hash: str
    score: float
    profile: SemanticProfile
    index_version: str
    semantic_input_revision: str
    analysis_id: str | None = None
    analysis_result_id: str | None = None
    source_occurrences: tuple[SourceOccurrenceProvenance, ...] = ()
    explanation: str | None = None

    def __post_init__(self) -> None:
        _require_hash(self.asset_id, "asset_id")
        _require_hash(self.content_hash, "content_hash")
        if not -1.0 <= self.score <= 1.0:
            raise ContractError("cosine similarity score must be between -1 and 1")

    def to_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "asset_id": self.asset_id,
            "content_hash": self.content_hash,
            "retrieval_mode": "semantic",
            "relationship_type": "semantically_related",
            "score": round(self.score, 6),
            "score_kind": "cosine_similarity",
            "model": self.profile.to_dict(),
            "index_id": self.profile.index_id,
            "index_version": self.index_version,
            "semantic_input_revision": self.semantic_input_revision,
        }
        if self.analysis_id is not None:
            value["analysis_id"] = self.analysis_id
        if self.analysis_result_id is not None:
            value["analysis_result_id"] = self.analysis_result_id
        if self.source_occurrences:
            value["provenance"] = {
                "source_occurrences": [occ.to_dict() for occ in self.source_occurrences]
            }
        if self.explanation is not None:
            value["explanation"] = {"deterministic": False, "summary": self.explanation}
        return value


@dataclass(frozen=True)
class HybridComponent:
    """One component contribution inside a Hybrid Search result."""

    retrieval_mode: Literal["metadata", "semantic", "visual_similarity"]
    relationship_type: str
    raw_score: float
    score_kind: str
    normalized_score: float
    weight: float
    model: dict[str, Any] | None
    index_id: str
    index_version: str
    analysis_id: str | None = None
    analysis_result_id: str | None = None

    def to_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "retrieval_mode": self.retrieval_mode,
            "relationship_type": self.relationship_type,
            "raw_score": round(self.raw_score, 6),
            "score_kind": self.score_kind,
            "normalized_score": round(self.normalized_score, 6),
            "weight": round(self.weight, 6),
            "model": self.model,
            "index_id": self.index_id,
            "index_version": self.index_version,
        }
        if self.analysis_id is not None:
            value["analysis_id"] = self.analysis_id
        if self.analysis_result_id is not None:
            value["analysis_result_id"] = self.analysis_result_id
        return value


@dataclass(frozen=True)
class HybridRanking:
    """Auditable ranking metadata for a Hybrid Search result."""

    final_score: float
    ranker: str = "weighted_sum"
    component_formula: str = "sum(component.normalized_score * component.weight)"
    notes: str = "Raw scores were normalized within their own component family before weighting."

    def to_dict(self) -> dict[str, Any]:
        return {
            "ranker": self.ranker,
            "final_score": round(self.final_score, 6),
            "component_formula": self.component_formula,
            "notes": self.notes,
        }


@dataclass(frozen=True)
class HybridSearchResult:
    """Hybrid Search result combining normalized component scores and deterministic pre-filters."""

    asset_id: str
    content_hash: str
    score: float
    components: tuple[HybridComponent, ...]
    ranking: HybridRanking
    relationship_type: str = "semantically_related"
    source_occurrences: tuple[SourceOccurrenceProvenance, ...] = ()
    explanation: str | None = None

    def __post_init__(self) -> None:
        _require_hash(self.asset_id, "asset_id")
        _require_hash(self.content_hash, "content_hash")

    def to_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "asset_id": self.asset_id,
            "content_hash": self.content_hash,
            "retrieval_mode": "hybrid",
            "relationship_type": self.relationship_type,
            "score": round(self.score, 6),
            "score_kind": "weighted_normalized_score",
            "components": [c.to_dict() for c in self.components],
            "ranking": self.ranking.to_dict(),
        }
        if self.source_occurrences:
            value["provenance"] = {
                "source_occurrences": [occ.to_dict() for occ in self.source_occurrences]
            }
        if self.explanation is not None:
            value["explanation"] = {"deterministic": False, "summary": self.explanation}
        return value
