"""Orchestration and immutable terminal-result persistence for canonical asset analysis."""

from __future__ import annotations

import hashlib
import json
import os
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, replace
from pathlib import Path
from tempfile import NamedTemporaryFile
from urllib.parse import unquote, urlparse
from uuid import uuid4

from .backends import (
    BackendUnavailable,
    OcrBackend,
    UnsupportedMedia,
    VisualBackend,
    is_decodable_image,
)
from .models import (
    AnalysisIssue,
    AnalysisProfile,
    AnalysisRecord,
    AnalysisStatus,
    AssetInput,
    ComponentStatus,
    ConfidenceLabel,
    ContractError,
    OcrResult,
    RuntimeDescriptor,
    VisualFeature,
    utc_now,
)
from .taxonomy import normalize_classifier_labels, summary_for


@dataclass(frozen=True)
class AnalysisOutcome:
    """The persisted normalized terminal result and whether an eligible result was reused."""

    record: AnalysisRecord
    reused: bool
    record_path: Path | None = None


class AnalysisStore:
    """Immutable terminal records plus a separate atomically updated current pointer."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)

    @staticmethod
    def _digest(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    def _logical_directory(self, asset_id: str, analysis_id: str) -> Path:
        return self.root / "records" / asset_id.removeprefix("sha256:") / self._digest(analysis_id)

    def result_path(self, record: AnalysisRecord) -> Path:
        if record.result_id is None:
            raise ContractError("only terminal results have a persistence path")
        return (
            self._logical_directory(record.asset_id, record.analysis_id)
            / f"{record.result_id}.json"
        )

    def current_path(self, asset_id: str, analysis_id: str) -> Path:
        return (
            self.root
            / "current"
            / asset_id.removeprefix("sha256:")
            / f"{self._digest(analysis_id)}.json"
        )

    @staticmethod
    def _write_atomic(path: Path, payload: dict[str, object]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        encoded = json.dumps(payload, sort_keys=True, ensure_ascii=False, indent=2) + "\n"
        with NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=path.parent, prefix=f".{path.name}.", delete=False
        ) as handle:
            handle.write(encoded)
            handle.flush()
            os.fsync(handle.fileno())
            temporary_path = Path(handle.name)
        os.replace(temporary_path, path)

    @staticmethod
    def _read_record(path: Path) -> AnalysisRecord | None:
        try:
            return AnalysisRecord.from_dict(json.loads(path.read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError):
            return None

    @staticmethod
    def _rank(record: AnalysisRecord) -> int:
        return {"ready": 3, "partial": 2, "unsupported": 1}.get(record.status, 0)

    def _should_prefer(self, candidate: AnalysisRecord, current: AnalysisRecord | None) -> bool:
        if current is None:
            return True
        candidate_rank = self._rank(candidate)
        current_rank = self._rank(current)
        if candidate_rank != current_rank:
            return candidate_rank > current_rank
        candidate_time = candidate.analysed_at or ""
        current_time = current.analysed_at or ""
        if candidate_time != current_time:
            return candidate_time > current_time
        return (candidate.result_id or "") > (current.result_id or "")

    def write(self, record: AnalysisRecord) -> Path:
        """Persist one immutable terminal result and update preferred pointer separately."""
        path = self.result_path(record)
        self._write_atomic(path, record.to_dict())
        current_path = self.current_path(record.asset_id, record.analysis_id)
        current = None
        if current_path.exists():
            try:
                pointer = json.loads(current_path.read_text(encoding="utf-8"))
                candidate_path = self.root / str(pointer["record_path"])
                current = self._read_record(candidate_path)
            except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError):
                current = None
        if self._should_prefer(record, current):
            self._write_atomic(
                current_path,
                {
                    "analysis_id": record.analysis_id,
                    "result_id": record.result_id,
                    "record_path": str(path.relative_to(self.root)),
                },
            )
        return path

    def read_current(
        self,
        asset: AssetInput,
        profile: AnalysisProfile,
        analyser: RuntimeDescriptor,
    ) -> AnalysisRecord | None:
        analysis_id = AnalysisRecord.make_analysis_id(asset, profile, analyser)
        pointer_path = self.current_path(asset.asset_id, analysis_id)
        if not pointer_path.exists():
            return None
        try:
            pointer = json.loads(pointer_path.read_text(encoding="utf-8"))
            record = self._read_record(self.root / str(pointer["record_path"]))
        except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError):
            return None
        if record is None:
            return None
        if (
            record.analysis_id != analysis_id
            or record.asset_id != asset.asset_id
            or record.expected_content_hash != asset.expected_content_hash
            or record.analysis_profile != profile
            or record.analyser != analyser
            or record.status not in {"ready", "partial", "unsupported"}
        ):
            return None
        return record

    def terminal_results(self, asset_id: str, analysis_id: str) -> list[AnalysisRecord]:
        """Return immutable terminal history for audit/testing, ordered by time then result ID."""
        directory = self._logical_directory(asset_id, analysis_id)
        if not directory.exists():
            return []
        records = [
            record for path in directory.glob("*.json") if (record := self._read_record(path))
        ]
        return sorted(
            records, key=lambda record: (record.analysed_at or "", record.result_id or "")
        )


def sha256_file(path: Path) -> str:
    """Hash exact input bytes without relying on names, MIME, or extraction paths."""
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return f"sha256:{digest.hexdigest()}"


@contextmanager
def verified_snapshot(path: Path) -> Iterator[tuple[Path, str]]:
    """Stream one opened canonical source into a private immutable analysis snapshot.

    The returned hash is calculated while copying the exact same bytes later
    consumed by image validation, model inference, and optional OCR. The source
    pathname is never reopened after verification, closing the TOCTOU window.
    """
    snapshot_path: Path | None = None
    try:
        digest = hashlib.sha256()
        with (
            path.open("rb") as source,
            NamedTemporaryFile(mode="w+b", prefix="analysis-verified-", delete=False) as snapshot,
        ):
            snapshot_path = Path(snapshot.name)
            for block in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(block)
                snapshot.write(block)
            snapshot.flush()
            os.fsync(snapshot.fileno())
        yield snapshot_path, f"sha256:{digest.hexdigest()}"
    finally:
        if snapshot_path is not None:
            try:
                snapshot_path.unlink()
            except FileNotFoundError:
                pass


def local_path_from_locator(locator: str) -> Path:
    """Support current filesystem canonical locators and explicit file URIs only."""
    parsed = urlparse(locator)
    if parsed.scheme == "file":
        return Path(unquote(parsed.path))
    if parsed.scheme:
        raise ValueError(f"unsupported canonical locator scheme: {parsed.scheme}")
    return Path(locator)


class AnalysisService:
    """Permanent local image-analysis capability behind stable project-owned contracts."""

    def __init__(
        self,
        *,
        backend: VisualBackend,
        output_root: str | Path,
        ocr_backend: OcrBackend | None = None,
        analysis_profile: AnalysisProfile | None = None,
    ) -> None:
        self.backend = backend
        self.store = AnalysisStore(output_root)
        self.ocr_backend = ocr_backend
        self.analysis_profile = analysis_profile or self._default_profile(backend, ocr_backend)

    @staticmethod
    def _default_profile(backend: VisualBackend, ocr_backend: OcrBackend | None) -> AnalysisProfile:
        requested_components: tuple[str, ...] = ("classification", "visual_features")
        component_revisions: tuple[tuple[str, str], ...] = (
            ("classification", f"{backend.descriptor.model_id}:{backend.descriptor.model_version}"),
            ("visual_features", backend.feature_spec.feature_extractor_revision),
        )
        if ocr_backend is not None:
            requested_components = (*requested_components, "ocr")
            engine = ocr_backend.engine
            component_revisions = (
                *component_revisions,
                ("ocr", f"{engine['engine_id']}:{engine['engine_version']}"),
            )
        return AnalysisProfile(
            requested_components=requested_components,
            component_revisions=component_revisions,
        )

    def _feature(
        self,
        *,
        asset: AssetInput,
        input_content_hash: str,
        analysis_id: str,
        result_id: str,
        values: list[float],
    ) -> VisualFeature:
        spec = self.backend.feature_spec
        return VisualFeature(
            feature_id=VisualFeature.make_feature_id(
                asset_id=asset.asset_id,
                input_content_hash=input_content_hash,
                feature_type=spec.feature_type,
                feature_model_id=spec.feature_model_id,
                feature_model_version=spec.feature_model_version,
                feature_extractor_revision=spec.feature_extractor_revision,
                dimensions=len(values),
                similarity_family=spec.similarity_family,
                normalization=spec.normalization,
            ),
            asset_id=asset.asset_id,
            input_content_hash=input_content_hash,
            feature_type=spec.feature_type,
            feature_model_id=spec.feature_model_id,
            feature_model_version=spec.feature_model_version,
            feature_extractor_revision=spec.feature_extractor_revision,
            dimensions=len(values),
            similarity_family=spec.similarity_family,
            normalization=spec.normalization,
            generated_at=utc_now(),
            values=values,
            analysis_id=analysis_id,
            result_id=result_id,
            analysis_profile_id=self.analysis_profile.profile_id,
            analysis_profile_version=self.analysis_profile.profile_version,
        )

    def _record(
        self,
        asset: AssetInput,
        *,
        status: AnalysisStatus,
        input_content_hash: str | None = None,
        observed_content_hash: str | None = None,
        summary: str | None = None,
        categories: list[ConfidenceLabel] | None = None,
        tags: list[ConfidenceLabel] | None = None,
        ocr: OcrResult | None = None,
        overall_confidence: float | None = None,
        components: list[ComponentStatus] | None = None,
        issues: list[AnalysisIssue] | None = None,
        feature_values: list[float] | None = None,
    ) -> AnalysisRecord:
        descriptor = self.backend.descriptor
        analysis_id = AnalysisRecord.make_analysis_id(asset, self.analysis_profile, descriptor)
        terminal = status not in {"pending", "processing"}
        result_id = str(uuid4()) if terminal else None
        record = AnalysisRecord(
            analysis_id=analysis_id,
            result_id=result_id,
            asset_id=asset.asset_id,
            expected_content_hash=asset.expected_content_hash,
            input_content_hash=input_content_hash,
            observed_content_hash=observed_content_hash,
            analysis_profile=self.analysis_profile,
            analyser=descriptor,
            analysed_at=utc_now() if terminal else None,
            status=status,
            summary=summary,
            categories=categories or [],
            tags=tags or [],
            ocr=ocr or OcrResult(),
            components=components or [],
            issues=issues or [],
            overall_confidence=overall_confidence,
        )
        if feature_values is None:
            return record
        if input_content_hash is None or result_id is None:
            raise ContractError("features require accepted input and a persisted terminal result")
        return replace(
            record,
            visual_features=[
                self._feature(
                    asset=asset,
                    input_content_hash=input_content_hash,
                    analysis_id=analysis_id,
                    result_id=result_id,
                    values=feature_values,
                )
            ],
        )

    def _persist(self, record: AnalysisRecord, reused: bool = False) -> AnalysisOutcome:
        return AnalysisOutcome(record=record, reused=reused, record_path=self.store.write(record))

    def analyse(self, asset: AssetInput, *, force: bool = False) -> AnalysisOutcome:
        """Verify one canonical byte snapshot, analyse it locally, and persist terminal history."""
        if not force:
            existing = self.store.read_current(
                asset, self.analysis_profile, self.backend.descriptor
            )
            if existing is not None and not self._requires_retry(existing):
                return AnalysisOutcome(
                    record=existing, reused=True, record_path=self.store.result_path(existing)
                )

        try:
            source_path = local_path_from_locator(asset.storage_locator)
        except ValueError as exc:
            return self._persist(
                self._record(
                    asset,
                    status="unsupported",
                    components=[ComponentStatus("input", "unsupported", str(exc))],
                    issues=[
                        AnalysisIssue("unsupported_locator", str(exc), "input", retryable=False)
                    ],
                )
            )
        if not source_path.is_file():
            return self._persist(
                self._record(
                    asset,
                    status="failed",
                    components=[
                        ComponentStatus("input", "failed", "canonical blob is unavailable")
                    ],
                    issues=[
                        AnalysisIssue(
                            "missing_input",
                            "authorised canonical asset locator does not resolve to a regular file",
                            "input",
                            retryable=True,
                        )
                    ],
                )
            )
        try:
            with verified_snapshot(source_path) as (snapshot_path, observed_hash):
                if observed_hash != asset.expected_content_hash:
                    return self._persist(
                        self._record(
                            asset,
                            status="stale",
                            observed_content_hash=observed_hash,
                            components=[ComponentStatus("input", "stale", "content hash mismatch")],
                            issues=[
                                AnalysisIssue(
                                    "input_hash_mismatch",
                                    "canonical bytes do not match the expected content hash; re-ingest or repair storage",
                                    "input",
                                    retryable=True,
                                )
                            ],
                        )
                    )
                return self._analyse_verified_snapshot(asset, snapshot_path)
        except OSError as exc:
            return self._persist(
                self._record(
                    asset,
                    status="failed",
                    components=[
                        ComponentStatus("input", "failed", "verified input snapshot is unavailable")
                    ],
                    issues=[AnalysisIssue("unreadable_input", str(exc), "input", retryable=True)],
                )
            )

    @staticmethod
    def _requires_retry(record: AnalysisRecord) -> bool:
        """Retry only terminal partial results with unresolved retryable component failures."""
        return record.status == "partial" and any(issue.retryable for issue in record.issues)

    def _analyse_verified_snapshot(self, asset: AssetInput, snapshot_path: Path) -> AnalysisOutcome:
        """Run all image components against the same private verified byte snapshot."""
        if not is_decodable_image(snapshot_path):
            is_image_claim = bool(asset.mime_type and asset.mime_type.startswith("image/"))
            return self._persist(
                self._record(
                    asset,
                    status="failed" if is_image_claim else "unsupported",
                    components=[
                        ComponentStatus(
                            "image_decode",
                            "failed" if is_image_claim else "unsupported",
                            "not a decodable supported image",
                        )
                    ],
                    issues=[
                        AnalysisIssue(
                            "corrupt_media" if is_image_claim else "unsupported_media",
                            "canonical bytes are not a decodable image supported by this runtime",
                            "image_decode",
                            retryable=False,
                        )
                    ],
                )
            )
        try:
            observation = self.backend.analyse_image(snapshot_path, asset.expected_content_hash)
        except BackendUnavailable as exc:
            return self._persist(
                self._record(
                    asset,
                    status="failed",
                    components=[ComponentStatus("classification", "failed", str(exc))],
                    issues=[
                        AnalysisIssue(
                            "model_unavailable", str(exc), "classification", retryable=True
                        )
                    ],
                )
            )
        except UnsupportedMedia as exc:
            return self._persist(
                self._record(
                    asset,
                    status="unsupported",
                    components=[ComponentStatus("classification", "unsupported", str(exc))],
                    issues=[
                        AnalysisIssue(
                            "unsupported_media", str(exc), "classification", retryable=False
                        )
                    ],
                )
            )
        except Exception as exc:  # noqa: BLE001 - backend details must never become a consumer contract.
            return self._persist(
                self._record(
                    asset,
                    status="failed",
                    input_content_hash=asset.expected_content_hash,
                    components=[
                        ComponentStatus(
                            "classification", "failed", "unexpected local model failure"
                        )
                    ],
                    issues=[
                        AnalysisIssue(
                            "visual_model_failed", str(exc), "classification", retryable=True
                        )
                    ],
                )
            )

        categories, tags = normalize_classifier_labels(observation.labels)
        components = [
            ComponentStatus("classification", "ready"),
            ComponentStatus("visual_features", "ready"),
        ]
        issues: list[AnalysisIssue] = []
        status: AnalysisStatus = "ready"
        ocr = OcrResult()
        if self.ocr_backend is None:
            components.append(ComponentStatus("ocr", "not_requested"))
        else:
            try:
                recognized = self.ocr_backend.detect(snapshot_path)
                text = " ".join(item.label for item in recognized)
                confidences = [
                    item.confidence for item in recognized if item.confidence is not None
                ]
                ocr = OcrResult(
                    state="ready",
                    engine=self.ocr_backend.engine,
                    text=text,
                    confidence=max(confidences) if confidences else None,
                )
                components.append(ComponentStatus("ocr", "ready"))
            except UnsupportedMedia as exc:
                status = "partial"
                ocr = OcrResult(state="unsupported", engine=self.ocr_backend.engine)
                components.append(ComponentStatus("ocr", "unsupported", str(exc)))
                issues.append(
                    AnalysisIssue("ocr_unsupported", str(exc), "ocr", "warning", retryable=False)
                )
            except BackendUnavailable as exc:
                status = "partial"
                ocr = OcrResult(state="failed", engine=self.ocr_backend.engine)
                components.append(ComponentStatus("ocr", "failed", str(exc)))
                issues.append(
                    AnalysisIssue("ocr_unavailable", str(exc), "ocr", "warning", retryable=True)
                )
            except Exception as exc:  # noqa: BLE001 - OCR must degrade without failing valid image analysis.
                status = "partial"
                ocr = OcrResult(state="failed", engine=self.ocr_backend.engine)
                components.append(ComponentStatus("ocr", "failed", "local OCR failed"))
                issues.append(
                    AnalysisIssue("ocr_failed", str(exc), "ocr", "warning", retryable=True)
                )

        primary_confidence = tags[0].confidence if tags else None
        return self._persist(
            self._record(
                asset,
                status=status,
                input_content_hash=asset.expected_content_hash,
                summary=summary_for(tags, categories),
                categories=categories,
                tags=tags,
                ocr=ocr,
                overall_confidence=primary_confidence,
                components=components,
                issues=issues,
                feature_values=observation.feature_values,
            )
        )
