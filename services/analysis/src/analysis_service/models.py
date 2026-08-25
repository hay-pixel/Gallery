"""Project-owned normalized contracts for the permanent visual-analysis boundary.

These types intentionally contain no provider-native payloads.  They are the
persisted contract consumed by Search, Gallery, and later Ollama work.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

ANALYSIS_SCHEMA = "analysis-record"
ANALYSIS_SCHEMA_VERSION = 1
VISUAL_FEATURE_SCHEMA = "visual-feature"
VISUAL_FEATURE_SCHEMA_VERSION = 1
HASH_PATTERN = re.compile(r"^sha256:[0-9a-f]{64}$")
AnalysisStatus = Literal[
    "pending", "processing", "ready", "partial", "unsupported", "failed", "stale"
]
ComponentState = Literal[
    "pending", "processing", "ready", "not_requested", "unsupported", "failed", "stale"
]
IssueSeverity = Literal["warning", "error"]
_TERMINAL_STATUSES = frozenset({"ready", "partial", "unsupported", "failed", "stale"})


class ContractError(ValueError):
    """Raised when an input or persisted analysis record violates the contract."""


def utc_now() -> str:
    """Return a portable RFC-3339 UTC timestamp with an explicit offset."""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _check_hash(value: str, field_name: str) -> None:
    if not HASH_PATTERN.fullmatch(value):
        raise ContractError(f"{field_name} must be an algorithm-qualified SHA-256 value")


def _check_nonempty(value: str, field_name: str) -> None:
    if not value or not value.strip():
        raise ContractError(f"{field_name} must not be empty")


def _check_confidence(value: float | None, field_name: str = "confidence") -> float | None:
    if value is None:
        return None
    number = float(value)
    if not math.isfinite(number) or not 0.0 <= number <= 1.0:
        raise ContractError(f"{field_name} must be finite and between 0 and 1")
    return round(number, 6)


def _check_finite_number(value: float, field_name: str) -> float:
    number = float(value)
    if not math.isfinite(number):
        raise ContractError(f"{field_name} must be finite")
    return number


@dataclass(frozen=True)
class AssetInput:
    """Authorised canonical asset information accepted by the analysis service."""

    asset_id: str
    expected_content_hash: str
    storage_locator: str
    mime_type: str | None = None

    def __post_init__(self) -> None:
        _check_hash(self.asset_id, "asset_id")
        _check_hash(self.expected_content_hash, "expected_content_hash")
        if self.asset_id != self.expected_content_hash:
            raise ContractError("canonical asset_id must equal expected_content_hash")
        _check_nonempty(self.storage_locator, "storage_locator")

    @classmethod
    def from_asset_record(cls, value: dict[str, Any]) -> AssetInput:
        """Validate and convert an accepted v1 canonical AssetRecord for analysis."""
        if not isinstance(value, dict):
            raise ContractError("asset record must be an object")
        if value.get("schema") != "asset-record":
            raise ContractError("analysis accepts only asset-record schema")
        if value.get("schema_version") != 1 or isinstance(value.get("schema_version"), bool):
            raise ContractError("analysis accepts only asset-record schema version 1")
        if value.get("processing_state") != "ready":
            raise ContractError("analysis accepts only canonical assets in ready state")
        for field_name in ("asset_id", "content_hash", "storage_locator", "mime_type"):
            if not isinstance(value.get(field_name), str):
                raise ContractError(f"asset record {field_name} must be a non-empty string")
            _check_nonempty(value[field_name], f"asset record {field_name}")
        if not isinstance(value.get("size_bytes"), int) or isinstance(
            value.get("size_bytes"), bool
        ):
            raise ContractError("asset record size_bytes must be a non-negative integer")
        if value["size_bytes"] < 0:
            raise ContractError("asset record size_bytes must be a non-negative integer")
        _check_hash(value["asset_id"], "asset record asset_id")
        _check_hash(value["content_hash"], "asset record content_hash")
        if value["asset_id"] != value["content_hash"]:
            raise ContractError("canonical asset record asset_id must equal content_hash")
        return cls(
            asset_id=value["asset_id"],
            expected_content_hash=value["content_hash"],
            storage_locator=value["storage_locator"],
            mime_type=value["mime_type"],
        )


@dataclass(frozen=True)
class AnalysisProfile:
    """Project-owned logical normalized-output configuration and component revisions."""

    profile_id: str = "image-default"
    profile_version: str = "1"
    normalization_revision: str = "taxonomy-classifier-v1"
    requested_components: tuple[str, ...] = ("classification", "visual_features")
    component_revisions: tuple[tuple[str, str], ...] = (
        ("classification", "resnet18-imagenet1k-v1"),
        ("visual_features", "resnet18-rgb-224-center-crop-avgpool-l2-v1"),
    )

    def __post_init__(self) -> None:
        _check_nonempty(self.profile_id, "analysis profile_id")
        _check_nonempty(self.profile_version, "analysis profile_version")
        _check_nonempty(self.normalization_revision, "analysis normalization_revision")
        for component in self.requested_components:
            _check_nonempty(component, "requested component")
        for name, revision in self.component_revisions:
            _check_nonempty(name, "component revision name")
            _check_nonempty(revision, "component revision")

    def to_dict(self) -> dict[str, Any]:
        return {
            "profile_id": self.profile_id,
            "profile_version": self.profile_version,
            "normalization_revision": self.normalization_revision,
            "requested_components": list(self.requested_components),
            "component_revisions": {name: revision for name, revision in self.component_revisions},
        }

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> AnalysisProfile:
        raw_revisions = value.get("component_revisions", {})
        if not isinstance(raw_revisions, dict):
            raise ContractError("analysis component_revisions must be an object")
        raw_requested = value.get("requested_components", [])
        if not isinstance(raw_requested, list):
            raise ContractError("analysis requested_components must be an array")
        if not isinstance(value.get("profile_id"), str):
            raise ContractError("analysis profile_id must be a string")
        if not isinstance(value.get("profile_version"), str):
            raise ContractError("analysis profile_version must be a string")
        if not isinstance(value.get("normalization_revision"), str):
            raise ContractError("analysis normalization_revision must be a string")
        return cls(
            profile_id=value["profile_id"],
            profile_version=value["profile_version"],
            normalization_revision=value["normalization_revision"],
            requested_components=tuple(str(item) for item in raw_requested),
            component_revisions=tuple(
                sorted((str(name), str(revision)) for name, revision in raw_revisions.items())
            ),
        )


@dataclass(frozen=True)
class RuntimeDescriptor:
    """Stable provenance for a deployable local analyser/runtime combination."""

    runtime_id: str
    runtime_version: str
    model_id: str
    model_version: str
    device_class: str | None = "cpu"
    implementation_version: str | None = None

    def __post_init__(self) -> None:
        for name, value in asdict(self).items():
            if value is not None:
                _check_nonempty(value, name)

    @property
    def revision_key(self) -> str:
        """Stable compact digest for implementation-local storage partitioning."""
        value = json.dumps(self.to_dict(), sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(value.encode("utf-8")).hexdigest()[:16]

    def to_dict(self) -> dict[str, str | None]:
        return asdict(self)


@dataclass(frozen=True)
class ConfidenceLabel:
    """A normalized browse/search label with bounded confidence and provenance."""

    label: str
    confidence: float | None = None
    source: str | None = None

    def __post_init__(self) -> None:
        _check_nonempty(self.label, "label")
        object.__setattr__(self, "confidence", _check_confidence(self.confidence))
        if self.source is not None:
            _check_nonempty(self.source, "label source")

    def to_dict(self) -> dict[str, Any]:
        return {"label": self.label, "confidence": self.confidence, "source": self.source}

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> ConfidenceLabel:
        return cls(
            label=str(value["label"]),
            confidence=value.get("confidence"),
            source=str(value["source"]) if value.get("source") is not None else None,
        )


@dataclass(frozen=True)
class ObjectObservation:
    """A grounded object/entity observation, never a whole-image classifier guess."""

    label: str
    source: str
    confidence: float | None = None
    count: int | None = None

    def __post_init__(self) -> None:
        _check_nonempty(self.label, "object label")
        _check_nonempty(self.source, "object source")
        object.__setattr__(self, "confidence", _check_confidence(self.confidence))
        if self.count is not None and self.count < 1:
            raise ContractError("object count must be positive when present")

    def to_dict(self) -> dict[str, Any]:
        return {
            "label": self.label,
            "source": self.source,
            "confidence": self.confidence,
            "count": self.count,
        }

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> ObjectObservation:
        return cls(
            label=str(value["label"]),
            source=str(value["source"]),
            confidence=value.get("confidence"),
            count=int(value["count"]) if value.get("count") is not None else None,
        )


@dataclass(frozen=True)
class OcrResult:
    """Explicit OCR state separate from descriptive visual metadata."""

    state: ComponentState = "not_requested"
    engine: dict[str, str] | None = None
    text: str = ""
    language: str | None = None
    confidence: float | None = None
    blocks: list[dict[str, Any]] = field(default_factory=list)

    def __post_init__(self) -> None:
        if self.state not in {
            "pending",
            "processing",
            "ready",
            "not_requested",
            "unsupported",
            "failed",
            "stale",
        }:
            raise ContractError("unsupported OCR state")
        object.__setattr__(self, "confidence", _check_confidence(self.confidence, "ocr confidence"))
        for block in self.blocks:
            if not isinstance(block, dict):
                raise ContractError("ocr blocks must contain objects")
            if "confidence" in block:
                _check_confidence(block["confidence"], "ocr block confidence")
        if self.state == "ready":
            if self.engine is None:
                raise ContractError("successful OCR requires engine provenance")
            _check_nonempty(str(self.engine.get("engine_id", "")), "ocr engine_id")
            _check_nonempty(str(self.engine.get("engine_version", "")), "ocr engine_version")
        if self.engine is not None:
            _check_nonempty(str(self.engine.get("engine_id", "")), "ocr engine_id")
            _check_nonempty(str(self.engine.get("engine_version", "")), "ocr engine_version")

    def to_dict(self) -> dict[str, Any]:
        return {
            "state": self.state,
            "engine": self.engine,
            "text": self.text,
            "language": self.language,
            "confidence": self.confidence,
            "blocks": self.blocks,
        }

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> OcrResult:
        engine = value.get("engine")
        if engine is not None and not isinstance(engine, dict):
            raise ContractError("ocr engine must be an object or null")
        blocks = value.get("blocks", [])
        if not isinstance(blocks, list):
            raise ContractError("ocr blocks must be an array")
        return cls(
            state=str(value["state"]),  # type: ignore[arg-type]
            engine={str(key): str(item) for key, item in engine.items()} if engine else None,
            text=str(value.get("text", "")),
            language=str(value["language"]) if value.get("language") is not None else None,
            confidence=value.get("confidence"),
            blocks=blocks,
        )


@dataclass(frozen=True)
class VisualFeature:
    """A self-describing, provider-independent feature record for visual Search."""

    feature_id: str
    asset_id: str
    input_content_hash: str
    feature_type: str
    feature_model_id: str
    feature_model_version: str
    feature_extractor_revision: str
    dimensions: int
    similarity_family: str
    normalization: dict[str, Any]
    generated_at: str
    values: list[float] | None = None
    storage_reference: str | None = None
    storage_format: str | None = None
    dtype: str | None = None
    byte_order: str | None = None
    checksum: str | None = None
    analysis_id: str | None = None
    result_id: str | None = None
    analysis_profile_id: str | None = None
    analysis_profile_version: str | None = None
    scope: str = "whole_image"
    schema: str = VISUAL_FEATURE_SCHEMA
    schema_version: int = VISUAL_FEATURE_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if (
            self.schema != VISUAL_FEATURE_SCHEMA
            or self.schema_version != VISUAL_FEATURE_SCHEMA_VERSION
        ):
            raise ContractError("unsupported visual feature schema/version")
        for field_name in (
            "feature_id",
            "feature_type",
            "feature_model_id",
            "feature_model_version",
            "feature_extractor_revision",
            "similarity_family",
            "scope",
        ):
            _check_nonempty(str(getattr(self, field_name)), field_name)
        _check_hash(self.asset_id, "feature asset_id")
        _check_hash(self.input_content_hash, "feature input_content_hash")
        if self.dimensions < 1:
            raise ContractError("feature dimensions must be positive")
        kind = self.normalization.get("kind")
        applied = self.normalization.get("applied")
        _check_nonempty(str(kind or ""), "feature normalization kind")
        if not isinstance(applied, bool):
            raise ContractError("feature normalization applied must be boolean")
        if self.values is not None:
            if len(self.values) != self.dimensions:
                raise ContractError("feature values length must equal dimensions")
            object.__setattr__(
                self,
                "values",
                [_check_finite_number(value, "feature value") for value in self.values],
            )
        if self.values is None and self.storage_reference is None:
            raise ContractError("feature must provide values or a storage_reference")
        if self.storage_reference is not None:
            for field_name in ("storage_format", "dtype", "byte_order", "checksum"):
                value = getattr(self, field_name)
                _check_nonempty(str(value or ""), field_name)
            _check_hash(str(self.checksum), "feature checksum")

    @property
    def compatibility_key(self) -> tuple[str, str, str, str, int, str, str, bool]:
        """The complete v1 vector-comparison identity Search must isolate."""
        return (
            self.feature_type,
            self.feature_model_id,
            self.feature_model_version,
            self.feature_extractor_revision,
            self.dimensions,
            self.similarity_family,
            str(self.normalization["kind"]),
            bool(self.normalization["applied"]),
        )

    @classmethod
    def make_feature_id(
        cls,
        *,
        asset_id: str,
        input_content_hash: str,
        feature_type: str,
        feature_model_id: str,
        feature_model_version: str,
        feature_extractor_revision: str,
        dimensions: int,
        similarity_family: str,
        normalization: dict[str, Any],
        scope: str = "whole_image",
    ) -> str:
        basis = json.dumps(
            {
                "asset_id": asset_id,
                "input_content_hash": input_content_hash,
                "feature_type": feature_type,
                "feature_model_id": feature_model_id,
                "feature_model_version": feature_model_version,
                "feature_extractor_revision": feature_extractor_revision,
                "dimensions": dimensions,
                "similarity_family": similarity_family,
                "normalization": normalization,
                "scope": scope,
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        return f"visual-feature:sha256:{hashlib.sha256(basis.encode('utf-8')).hexdigest()}"

    def to_dict(self) -> dict[str, Any]:
        value: dict[str, Any] = {
            "schema": self.schema,
            "schema_version": self.schema_version,
            "feature_id": self.feature_id,
            "asset_id": self.asset_id,
            "input_content_hash": self.input_content_hash,
            "feature_type": self.feature_type,
            "feature_model_id": self.feature_model_id,
            "feature_model_version": self.feature_model_version,
            "feature_extractor_revision": self.feature_extractor_revision,
            "dimensions": self.dimensions,
            "similarity_family": self.similarity_family,
            "normalization": self.normalization,
            "generated_at": self.generated_at,
            "values": self.values,
            "storage_reference": self.storage_reference,
            "storage_format": self.storage_format,
            "dtype": self.dtype,
            "byte_order": self.byte_order,
            "checksum": self.checksum,
            "analysis_id": self.analysis_id,
            "result_id": self.result_id,
            "analysis_profile_id": self.analysis_profile_id,
            "analysis_profile_version": self.analysis_profile_version,
            "scope": self.scope,
        }
        return value

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> VisualFeature:
        normalization = value.get("normalization")
        if not isinstance(normalization, dict):
            raise ContractError("feature normalization must be an object")
        return cls(
            feature_id=str(value["feature_id"]),
            asset_id=str(value["asset_id"]),
            input_content_hash=str(value["input_content_hash"]),
            feature_type=str(value["feature_type"]),
            feature_model_id=str(value["feature_model_id"]),
            feature_model_version=str(value["feature_model_version"]),
            feature_extractor_revision=str(value["feature_extractor_revision"]),
            dimensions=int(value["dimensions"]),
            similarity_family=str(value["similarity_family"]),
            normalization=normalization,
            generated_at=str(value["generated_at"]),
            values=[float(item) for item in value["values"]]
            if value.get("values") is not None
            else None,
            storage_reference=str(value["storage_reference"])
            if value.get("storage_reference") is not None
            else None,
            storage_format=str(value["storage_format"])
            if value.get("storage_format") is not None
            else None,
            dtype=str(value["dtype"]) if value.get("dtype") is not None else None,
            byte_order=str(value["byte_order"]) if value.get("byte_order") is not None else None,
            checksum=str(value["checksum"]) if value.get("checksum") is not None else None,
            analysis_id=str(value["analysis_id"]) if value.get("analysis_id") is not None else None,
            result_id=str(value["result_id"]) if value.get("result_id") is not None else None,
            analysis_profile_id=str(value["analysis_profile_id"])
            if value.get("analysis_profile_id") is not None
            else None,
            analysis_profile_version=str(value["analysis_profile_version"])
            if value.get("analysis_profile_version") is not None
            else None,
            scope=str(value.get("scope", "whole_image")),
            schema=str(value.get("schema", "")),
            schema_version=int(value.get("schema_version", -1)),
        )


@dataclass(frozen=True)
class AnalysisIssue:
    """A normalized, non-provider-specific diagnostic record."""

    code: str
    message: str
    component: str
    severity: IssueSeverity = "error"
    retryable: bool = False

    def __post_init__(self) -> None:
        _check_nonempty(self.code, "issue code")
        _check_nonempty(self.message, "issue message")
        _check_nonempty(self.component, "issue component")
        if self.severity not in {"warning", "error"}:
            raise ContractError("issue severity must be warning or error")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> AnalysisIssue:
        return cls(
            code=str(value["code"]),
            message=str(value["message"]),
            component=str(value["component"]),
            severity=str(value.get("severity", "error")),  # type: ignore[arg-type]
            retryable=bool(value.get("retryable", False)),
        )


@dataclass(frozen=True)
class ComponentStatus:
    """Explicit independently degradable capability state."""

    component: str
    state: ComponentState
    detail: str | None = None

    def __post_init__(self) -> None:
        _check_nonempty(self.component, "component")
        if self.state not in {
            "pending",
            "processing",
            "ready",
            "not_requested",
            "unsupported",
            "failed",
            "stale",
        }:
            raise ContractError("unsupported component state")

    def to_dict(self) -> dict[str, Any]:
        return {"component": self.component, "state": self.state, "detail": self.detail}

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> ComponentStatus:
        return cls(
            component=str(value["component"]),
            state=str(value["state"]),  # type: ignore[arg-type]
            detail=str(value["detail"]) if value.get("detail") is not None else None,
        )


@dataclass(frozen=True)
class AnalysisRecord:
    """One logical analysis state or persisted immutable terminal result."""

    analysis_id: str
    result_id: str | None
    asset_id: str
    expected_content_hash: str
    input_content_hash: str | None
    observed_content_hash: str | None
    analysis_profile: AnalysisProfile
    analyser: RuntimeDescriptor
    analysed_at: str | None
    status: AnalysisStatus
    summary: str | None = None
    objects: list[ObjectObservation] = field(default_factory=list)
    categories: list[ConfidenceLabel] = field(default_factory=list)
    tags: list[ConfidenceLabel] = field(default_factory=list)
    scene: dict[str, Any] | None = None
    ocr: OcrResult = field(default_factory=OcrResult)
    visual_features: list[VisualFeature] = field(default_factory=list)
    components: list[ComponentStatus] = field(default_factory=list)
    issues: list[AnalysisIssue] = field(default_factory=list)
    overall_confidence: float | None = None
    schema: str = ANALYSIS_SCHEMA
    schema_version: int = ANALYSIS_SCHEMA_VERSION

    def __post_init__(self) -> None:
        if self.schema != ANALYSIS_SCHEMA or self.schema_version != ANALYSIS_SCHEMA_VERSION:
            raise ContractError("unsupported analysis record schema/version")
        if self.status not in {
            "pending",
            "processing",
            "ready",
            "partial",
            "unsupported",
            "failed",
            "stale",
        }:
            raise ContractError("unsupported analysis status")
        _check_nonempty(self.analysis_id, "analysis_id")
        _check_hash(self.asset_id, "asset_id")
        _check_hash(self.expected_content_hash, "expected_content_hash")
        if self.input_content_hash is not None:
            _check_hash(self.input_content_hash, "input_content_hash")
        if self.observed_content_hash is not None:
            _check_hash(self.observed_content_hash, "observed_content_hash")
        terminal = self.status in _TERMINAL_STATUSES
        if terminal:
            if self.result_id is None:
                raise ContractError("persisted terminal analysis outcomes require result_id")
            try:
                result_uuid = UUID(self.result_id)
            except (ValueError, AttributeError) as exc:
                raise ContractError("result_id must be a project-owned UUID string") from exc
            if result_uuid.version != 4:
                raise ContractError("image-v1 result_id must be UUIDv4")
            if self.analysed_at is None:
                raise ContractError("terminal analysis outcomes require analysed_at")
        elif self.result_id is not None:
            raise ContractError("transient pending/processing records must not have result_id")
        if (
            self.status in {"ready", "partial"}
            and self.input_content_hash != self.expected_content_hash
        ):
            raise ContractError(
                "inference-bearing ready/partial output requires verified expected input hash"
            )
        if self.input_content_hash is None:
            if (
                self.summary is not None
                or self.objects
                or self.categories
                or self.tags
                or self.visual_features
            ):
                raise ContractError("unverified input must not emit visual metadata or features")
            if self.ocr.state == "ready":
                raise ContractError("unverified input must not emit successful OCR")
        object.__setattr__(
            self,
            "overall_confidence",
            _check_confidence(self.overall_confidence, "overall_confidence"),
        )
        if self.scene is not None:
            if not isinstance(self.scene, dict):
                raise ContractError("scene must be an object or null")
            if "confidence" in self.scene:
                _check_confidence(self.scene["confidence"], "scene confidence")
        for feature in self.visual_features:
            if feature.asset_id != self.asset_id:
                raise ContractError("visual feature asset_id must match analysis asset_id")
            if feature.input_content_hash != self.input_content_hash:
                raise ContractError(
                    "visual feature input hash must match accepted analysis input hash"
                )
            if feature.analysis_id not in {None, self.analysis_id}:
                raise ContractError("visual feature analysis_id must match analysis record")
            if feature.result_id not in {None, self.result_id}:
                raise ContractError("visual feature result_id must match analysis record")

    @classmethod
    def make_analysis_id(
        cls,
        asset: AssetInput,
        analysis_profile: AnalysisProfile,
        analyser: RuntimeDescriptor,
    ) -> str:
        """Create deterministic project-owned logical identity from material semantics only."""
        basis = json.dumps(
            {
                "asset_id": asset.asset_id,
                "expected_content_hash": asset.expected_content_hash,
                "schema": ANALYSIS_SCHEMA,
                "schema_version": ANALYSIS_SCHEMA_VERSION,
                "analysis_profile": analysis_profile.to_dict(),
                "analyser": analyser.to_dict(),
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        return f"analysis:sha256:{hashlib.sha256(basis.encode('utf-8')).hexdigest()}"

    def to_dict(self) -> dict[str, Any]:
        """Serialize normalized project-owned data without raw model/SDK payloads."""
        return {
            "schema": self.schema,
            "schema_version": self.schema_version,
            "analysis_id": self.analysis_id,
            "result_id": self.result_id,
            "asset_id": self.asset_id,
            "expected_content_hash": self.expected_content_hash,
            "input_content_hash": self.input_content_hash,
            "observed_content_hash": self.observed_content_hash,
            "analysis_profile": self.analysis_profile.to_dict(),
            "analyser": self.analyser.to_dict(),
            "analysed_at": self.analysed_at,
            "status": self.status,
            "summary": self.summary,
            "objects": [item.to_dict() for item in self.objects],
            "categories": [item.to_dict() for item in self.categories],
            "tags": [item.to_dict() for item in self.tags],
            "scene": self.scene,
            "ocr": self.ocr.to_dict(),
            "visual_features": [item.to_dict() for item in self.visual_features],
            "components": [item.to_dict() for item in self.components],
            "issues": [item.to_dict() for item in self.issues],
            "overall_confidence": self.overall_confidence,
        }

    @classmethod
    def from_dict(cls, value: dict[str, Any]) -> AnalysisRecord:
        profile = value.get("analysis_profile")
        analyser = value.get("analyser")
        ocr = value.get("ocr")
        if (
            not isinstance(profile, dict)
            or not isinstance(analyser, dict)
            or not isinstance(ocr, dict)
        ):
            raise ContractError("analysis profile, analyser, and ocr must be objects")
        return cls(
            analysis_id=str(value["analysis_id"]),
            result_id=str(value["result_id"]) if value.get("result_id") is not None else None,
            asset_id=str(value["asset_id"]),
            expected_content_hash=str(value["expected_content_hash"]),
            input_content_hash=str(value["input_content_hash"])
            if value.get("input_content_hash") is not None
            else None,
            observed_content_hash=str(value["observed_content_hash"])
            if value.get("observed_content_hash") is not None
            else None,
            analysis_profile=AnalysisProfile.from_dict(profile),
            analyser=RuntimeDescriptor(**analyser),
            analysed_at=str(value["analysed_at"]) if value.get("analysed_at") is not None else None,
            status=str(value["status"]),  # type: ignore[arg-type]
            summary=str(value["summary"]) if value.get("summary") is not None else None,
            objects=[ObjectObservation.from_dict(item) for item in value.get("objects", [])],
            categories=[ConfidenceLabel.from_dict(item) for item in value.get("categories", [])],
            tags=[ConfidenceLabel.from_dict(item) for item in value.get("tags", [])],
            scene=value.get("scene"),
            ocr=OcrResult.from_dict(ocr),
            visual_features=[
                VisualFeature.from_dict(item) for item in value.get("visual_features", [])
            ],
            components=[ComponentStatus.from_dict(item) for item in value.get("components", [])],
            issues=[AnalysisIssue.from_dict(item) for item in value.get("issues", [])],
            overall_confidence=value.get("overall_confidence"),
            schema=str(value.get("schema", "")),
            schema_version=int(value.get("schema_version", -1)),
        )
