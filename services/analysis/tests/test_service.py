from __future__ import annotations

import hashlib
import json
from pathlib import Path

from analysis_service.models import AssetInput
from analysis_service.service import AnalysisService


def test_valid_common_image_produces_contract_ready_record(
    tmp_path: Path, canonical_image: tuple[Path, AssetInput], stub_backend: object
) -> None:
    _, asset = canonical_image
    service = AnalysisService(backend=stub_backend, output_root=tmp_path / "analysis")  # type: ignore[arg-type]

    result = service.analyse(asset)

    assert result.reused is False
    assert result.record.status == "ready"
    assert result.record.result_id is not None
    assert result.record.asset_id == asset.asset_id
    assert result.record.expected_content_hash == asset.expected_content_hash
    assert result.record.input_content_hash == asset.expected_content_hash
    assert result.record.observed_content_hash is None
    assert (
        result.record.summary == "Whole-image classifier associated this image with car (vehicle)."
    )
    assert result.record.objects == []
    assert [(item.label, item.source) for item in result.record.categories] == [
        ("vehicle", "classifier"),
        ("animal", "classifier"),
    ]
    assert {(item.label, item.source) for item in result.record.tags} == {
        ("car", "classifier"),
        ("dog", "classifier"),
    }
    assert result.record.ocr.state == "not_requested"
    assert result.record.components[-1].state == "not_requested"
    feature = result.record.visual_features[0]
    assert feature.asset_id == asset.asset_id
    assert feature.input_content_hash == asset.expected_content_hash
    assert feature.feature_extractor_revision == "test-rgb-96x64-l2-v1"
    assert feature.compatibility_key[-2:] == ("l2", True)
    assert feature.result_id == result.record.result_id
    assert result.record_path is not None and result.record_path.is_file()
    assert json.loads(result.record_path.read_text(encoding="utf-8")) == result.record.to_dict()


def test_corrupt_claimed_image_is_typed_failure_without_inference_metadata(
    tmp_path: Path, stub_backend: object
) -> None:
    corrupt = tmp_path / "corrupt.png"
    corrupt.write_bytes(b"not an image")
    digest = f"sha256:{hashlib.sha256(corrupt.read_bytes()).hexdigest()}"
    asset = AssetInput(digest, digest, str(corrupt), "image/png")

    result = AnalysisService(backend=stub_backend, output_root=tmp_path / "analysis").analyse(asset)  # type: ignore[arg-type]

    assert result.record.status == "failed"
    assert result.record.issues[0].code == "corrupt_media"
    assert result.record.input_content_hash is None
    assert result.record.summary is None
    assert result.record.visual_features == []


def test_content_hash_mismatch_fails_closed_with_observed_hash(
    tmp_path: Path, canonical_image: tuple[Path, AssetInput], stub_backend: object
) -> None:
    path, expected = canonical_image
    replacement = b"another-byte-value"
    wrong_hash = f"sha256:{hashlib.sha256(replacement).hexdigest()}"
    path.write_bytes(replacement)

    result = AnalysisService(backend=stub_backend, output_root=tmp_path / "analysis").analyse(
        expected
    )  # type: ignore[arg-type]

    assert result.record.status == "stale"
    assert result.record.expected_content_hash == expected.expected_content_hash
    assert result.record.input_content_hash is None
    assert result.record.observed_content_hash == wrong_hash
    assert result.record.issues[0].code == "input_hash_mismatch"
    assert result.record.summary is None
    assert result.record.categories == []
    assert result.record.tags == []
    assert result.record.visual_features == []
    assert stub_backend.calls == 0  # type: ignore[attr-defined]


def test_repeat_analysis_reuses_eligible_current_terminal_result(
    tmp_path: Path, canonical_image: tuple[Path, AssetInput], stub_backend: object
) -> None:
    _, asset = canonical_image
    service = AnalysisService(backend=stub_backend, output_root=tmp_path / "analysis")  # type: ignore[arg-type]

    first = service.analyse(asset)
    second = service.analyse(asset)

    assert first.reused is False
    assert second.reused is True
    assert first.record.to_dict() == second.record.to_dict()
    assert stub_backend.calls == 1  # type: ignore[attr-defined]


def test_forced_rerun_preserves_immutable_terminal_history(
    tmp_path: Path, canonical_image: tuple[Path, AssetInput], stub_backend: object
) -> None:
    _, asset = canonical_image
    service = AnalysisService(backend=stub_backend, output_root=tmp_path / "analysis")  # type: ignore[arg-type]

    first = service.analyse(asset)
    rerun = service.analyse(asset, force=True)
    history = service.store.terminal_results(asset.asset_id, first.record.analysis_id)

    assert first.reused is False
    assert rerun.reused is False
    assert first.record.analysis_id == rerun.record.analysis_id
    assert first.record.result_id != rerun.record.result_id
    assert len(history) == 2
    assert {record.result_id for record in history} == {
        first.record.result_id,
        rerun.record.result_id,
    }
    assert first.record_path is not None and first.record_path.is_file()
    assert rerun.record_path is not None and rerun.record_path.is_file()
    assert stub_backend.calls == 2  # type: ignore[attr-defined]


def test_missing_then_successful_retry_preserves_failed_history(
    tmp_path: Path, canonical_image: tuple[Path, AssetInput], stub_backend: object
) -> None:
    path, asset = canonical_image
    original_bytes = path.read_bytes()
    path.unlink()
    service = AnalysisService(backend=stub_backend, output_root=tmp_path / "analysis")  # type: ignore[arg-type]

    missing = service.analyse(asset)
    path.write_bytes(original_bytes)
    retry = service.analyse(asset)
    history = service.store.terminal_results(asset.asset_id, missing.record.analysis_id)

    assert missing.record.status == "failed"
    assert missing.record.issues[0].code == "missing_input"
    assert retry.record.status == "ready"
    assert missing.record.analysis_id == retry.record.analysis_id
    assert missing.record.result_id != retry.record.result_id
    assert [record.status for record in history] == ["failed", "ready"]
    assert (
        service.store.read_current(asset, service.analysis_profile, service.backend.descriptor)
        == retry.record
    )


def test_model_and_feature_versions_and_compatibility_are_recorded(
    tmp_path: Path, canonical_image: tuple[Path, AssetInput], stub_backend: object
) -> None:
    _, asset = canonical_image
    result = AnalysisService(backend=stub_backend, output_root=tmp_path / "analysis").analyse(asset)  # type: ignore[arg-type]

    assert result.record.analyser.model_id == "test/fixture-classifier"
    assert result.record.analyser.model_version == "2026-08-25"
    feature = result.record.visual_features[0]
    assert feature.feature_model_id == result.record.analyser.model_id
    assert feature.feature_model_version == result.record.analyser.model_version
    assert feature.dimensions == 4
    assert feature.input_content_hash == asset.expected_content_hash
    assert feature.values is not None
    assert len(feature.values) == feature.dimensions
    assert feature.normalization == {"kind": "l2", "applied": True}
    assert feature.similarity_family == "cosine"


def test_missing_canonical_blob_is_retryable_failure_with_null_input_hash(
    tmp_path: Path, stub_backend: object
) -> None:
    digest = "sha256:" + "c" * 64
    asset = AssetInput(digest, digest, str(tmp_path / "missing.png"), "image/png")

    result = AnalysisService(backend=stub_backend, output_root=tmp_path / "analysis").analyse(asset)  # type: ignore[arg-type]

    assert result.record.status == "failed"
    assert result.record.input_content_hash is None
    assert result.record.observed_content_hash is None
    assert result.record.issues[0].code == "missing_input"
    assert result.record.issues[0].retryable is True


def test_verified_snapshot_is_used_when_source_is_replaced_during_analysis(
    tmp_path: Path, canonical_image: tuple[Path, AssetInput], stub_backend: object
) -> None:
    source_path, asset = canonical_image
    original_bytes = source_path.read_bytes()
    snapshot_paths: list[Path] = []
    original_analyse = stub_backend.analyse_image  # type: ignore[attr-defined]

    def mutate_source_then_analyse(snapshot_path: Path, source_content_hash: str) -> object:
        source_path.write_bytes(b"replaced-after-verification")
        snapshot_paths.append(snapshot_path)
        assert snapshot_path != source_path
        assert snapshot_path.read_bytes() == original_bytes
        return original_analyse(snapshot_path, source_content_hash)

    stub_backend.analyse_image = mutate_source_then_analyse  # type: ignore[attr-defined,method-assign]
    result = AnalysisService(backend=stub_backend, output_root=tmp_path / "analysis").analyse(asset)  # type: ignore[arg-type]

    assert result.record.status == "ready"
    assert result.record.input_content_hash == asset.expected_content_hash
    assert source_path.read_bytes() != original_bytes
    assert len(snapshot_paths) == 1
    assert not snapshot_paths[0].exists()


class _UnavailableOcr:
    @property
    def engine(self) -> dict[str, str]:
        return {"engine_id": "test-ocr", "engine_version": "1"}

    def detect(self, path: Path) -> list[object]:
        from analysis_service.backends import BackendUnavailable

        raise BackendUnavailable("temporary OCR worker outage")


class _ReadyOcr:
    @property
    def engine(self) -> dict[str, str]:
        return {"engine_id": "test-ocr", "engine_version": "1"}

    def detect(self, path: Path) -> list[object]:
        return []


def test_retryable_partial_is_retried_when_ocr_recovers(
    tmp_path: Path, canonical_image: tuple[Path, AssetInput], stub_backend: object
) -> None:
    _, asset = canonical_image
    first_service = AnalysisService(
        backend=stub_backend,  # type: ignore[arg-type]
        output_root=tmp_path / "analysis",
        ocr_backend=_UnavailableOcr(),  # type: ignore[arg-type]
    )
    partial = first_service.analyse(asset)
    second_service = AnalysisService(
        backend=stub_backend,  # type: ignore[arg-type]
        output_root=tmp_path / "analysis",
        ocr_backend=_ReadyOcr(),  # type: ignore[arg-type]
    )

    recovered = second_service.analyse(asset)
    history = second_service.store.terminal_results(asset.asset_id, partial.record.analysis_id)

    assert partial.record.status == "partial"
    assert partial.record.issues[0].code == "ocr_unavailable"
    assert partial.record.issues[0].retryable is True
    assert recovered.reused is False
    assert recovered.record.status == "ready"
    assert recovered.record.ocr.state == "ready"
    assert [record.status for record in history] == ["partial", "ready"]
    assert stub_backend.calls == 2  # type: ignore[attr-defined]


def test_failed_forced_rerun_preserves_previous_successful_preferred_result(
    tmp_path: Path, canonical_image: tuple[Path, AssetInput], stub_backend: object
) -> None:
    _, asset = canonical_image
    service = AnalysisService(backend=stub_backend, output_root=tmp_path / "analysis")  # type: ignore[arg-type]
    success = service.analyse(asset)

    def fail_backend(path: Path, source_content_hash: str) -> object:
        raise RuntimeError("temporary classifier failure")

    stub_backend.analyse_image = fail_backend  # type: ignore[attr-defined,method-assign]
    failed = service.analyse(asset, force=True)
    history = service.store.terminal_results(asset.asset_id, success.record.analysis_id)
    current = service.store.read_current(
        asset, service.analysis_profile, service.backend.descriptor
    )

    assert success.record.status == "ready"
    assert failed.record.status == "failed"
    assert success.record.result_id != failed.record.result_id
    assert {record.status for record in history} == {"ready", "failed"}
    assert current is not None and current.result_id == success.record.result_id
