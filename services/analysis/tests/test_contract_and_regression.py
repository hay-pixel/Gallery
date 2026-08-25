from __future__ import annotations

import math
import os
import re
import subprocess
import sys
from pathlib import Path
from uuid import uuid4

import pytest

from analysis_service.models import (
    AnalysisProfile,
    AnalysisRecord,
    AssetInput,
    ContractError,
    OcrResult,
    RuntimeDescriptor,
    VisualFeature,
    utc_now,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT / "src" / "analysis_service"
PRODUCTION_CONFIGS = (ROOT / "pyproject.toml", ROOT / "requirements-cpu.txt")


def _asset_and_descriptor() -> tuple[AssetInput, RuntimeDescriptor]:
    digest = "sha256:" + "b" * 64
    return AssetInput(digest, digest, "/canonical/blob"), RuntimeDescriptor(
        "python/test", "1", "local/test", "1"
    )


def _profile() -> AnalysisProfile:
    return AnalysisProfile(
        profile_id="image-default",
        profile_version="1",
        normalization_revision="test-taxonomy-v1",
        requested_components=("classification", "visual_features"),
        component_revisions=(
            ("classification", "local-test-v1"),
            ("visual_features", "test-l2-v1"),
        ),
    )


def _feature(asset: AssetInput, analysis_id: str, result_id: str) -> VisualFeature:
    normalization = {"kind": "l2", "applied": True}
    return VisualFeature(
        feature_id=VisualFeature.make_feature_id(
            asset_id=asset.asset_id,
            input_content_hash=asset.expected_content_hash,
            feature_type="image_embedding",
            feature_model_id="local/test",
            feature_model_version="1",
            feature_extractor_revision="test-l2-v1",
            dimensions=2,
            similarity_family="cosine",
            normalization=normalization,
        ),
        asset_id=asset.asset_id,
        input_content_hash=asset.expected_content_hash,
        feature_type="image_embedding",
        feature_model_id="local/test",
        feature_model_version="1",
        feature_extractor_revision="test-l2-v1",
        dimensions=2,
        similarity_family="cosine",
        normalization=normalization,
        generated_at=utc_now(),
        values=[0.6, 0.8],
        analysis_id=analysis_id,
        result_id=result_id,
        analysis_profile_id="image-default",
        analysis_profile_version="1",
    )


def test_normalized_record_excludes_build_agent_specific_fields() -> None:
    asset, descriptor = _asset_and_descriptor()
    profile = _profile()
    analysis_id = AnalysisRecord.make_analysis_id(asset, profile, descriptor)
    result_id = str(uuid4())
    record = AnalysisRecord(
        analysis_id=analysis_id,
        result_id=result_id,
        asset_id=asset.asset_id,
        expected_content_hash=asset.expected_content_hash,
        input_content_hash=asset.expected_content_hash,
        observed_content_hash=None,
        analysis_profile=profile,
        analyser=descriptor,
        analysed_at=utc_now(),
        status="ready",
        ocr=OcrResult(),
        visual_features=[_feature(asset, analysis_id, result_id)],
    )
    payload = record.to_dict()
    serialized = str(payload).casefold()
    forbidden = ("build_agent", "provider_response", "raw_response", "sdk_payload")
    assert not any(value in serialized for value in forbidden)
    assert payload["schema"] == "analysis-record"
    assert payload["schema_version"] == 1
    assert payload["result_id"] == result_id
    assert payload["analysis_profile"]["profile_version"] == "1"


def test_analysis_id_is_deterministic_and_changes_for_profile_normalization_revision() -> None:
    asset, descriptor = _asset_and_descriptor()
    original = _profile()
    changed = AnalysisProfile(
        profile_id=original.profile_id,
        profile_version=original.profile_version,
        normalization_revision="test-taxonomy-v2",
        requested_components=original.requested_components,
        component_revisions=original.component_revisions,
    )
    assert AnalysisRecord.make_analysis_id(
        asset, original, descriptor
    ) == AnalysisRecord.make_analysis_id(asset, original, descriptor)
    assert AnalysisRecord.make_analysis_id(
        asset, original, descriptor
    ) != AnalysisRecord.make_analysis_id(asset, changed, descriptor)


def test_feature_rejects_incompatible_analysis_input_hash() -> None:
    asset, descriptor = _asset_and_descriptor()
    profile = _profile()
    analysis_id = AnalysisRecord.make_analysis_id(asset, profile, descriptor)
    result_id = str(uuid4())
    feature = _feature(asset, analysis_id, result_id)
    wrong = VisualFeature(**{**feature.__dict__, "input_content_hash": "sha256:" + "c" * 64})
    with pytest.raises(ContractError, match="input hash"):
        AnalysisRecord(
            analysis_id=analysis_id,
            result_id=result_id,
            asset_id=asset.asset_id,
            expected_content_hash=asset.expected_content_hash,
            input_content_hash=asset.expected_content_hash,
            observed_content_hash=None,
            analysis_profile=profile,
            analyser=descriptor,
            analysed_at=utc_now(),
            status="ready",
            ocr=OcrResult(),
            visual_features=[wrong],
        )


def test_feature_rejects_nonfinite_values_and_missing_extractor_revision() -> None:
    (
        asset,
        _,
    ) = _asset_and_descriptor()
    normalization = {"kind": "l2", "applied": True}
    common = {
        "feature_id": "visual-feature:sha256:" + "a" * 64,
        "asset_id": asset.asset_id,
        "input_content_hash": asset.expected_content_hash,
        "feature_type": "image_embedding",
        "feature_model_id": "local/test",
        "feature_model_version": "1",
        "dimensions": 2,
        "similarity_family": "cosine",
        "normalization": normalization,
        "generated_at": utc_now(),
        "values": [0.0, math.inf],
    }
    with pytest.raises(ContractError, match="feature value"):
        VisualFeature(feature_extractor_revision="test-l2-v1", **common)
    with pytest.raises(ContractError, match="feature_extractor_revision"):
        VisualFeature(feature_extractor_revision="", **{**common, "values": [0.0, 1.0]})


def test_ocr_ready_requires_engine_provenance_and_states_remain_distinct() -> None:
    with pytest.raises(ContractError, match="successful OCR"):
        OcrResult(state="ready", text="TOTAL")
    ready = OcrResult(
        state="ready",
        engine={"engine_id": "local-test-ocr", "engine_version": "1"},
        text="",
    )
    assert OcrResult().state == "not_requested"
    assert OcrResult(state="unsupported").state == "unsupported"
    assert OcrResult(state="failed").state == "failed"
    assert ready.state == "ready" and ready.text == ""


def test_import_and_service_contract_do_not_need_build_agent_environment() -> None:
    environment = {
        key: value
        for key, value in os.environ.items()
        if "manus" not in key.casefold() and "agent" not in key.casefold()
    }
    environment["PYTHONPATH"] = str(ROOT / "src")
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from analysis_service import AnalysisService, AssetInput; print('imported')",
        ],
        env=environment,
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "imported"


def test_production_source_has_no_build_agent_runtime_dependency() -> None:
    forbidden_patterns = (
        r"MANUS_API",
        r"manus\.ai",
        r"space\.manus",
        r"from\s+manus(?:\.|\s+import)",
        r"import\s+manus(?:\s|$)",
        r"manus[_-](?:client|sdk|endpoint|url|token|credential)",
    )
    production_files = [*SOURCE_ROOT.rglob("*.py"), *PRODUCTION_CONFIGS]
    production_text = "\n".join(path.read_text(encoding="utf-8") for path in production_files)
    for pattern in forbidden_patterns:
        assert re.search(pattern, production_text, flags=re.IGNORECASE) is None, pattern


def test_profile_version_deserialization_rejects_numeric_value() -> None:
    with pytest.raises(ContractError, match="profile_version must be a string"):
        AnalysisProfile.from_dict(
            {
                "profile_id": "image-default",
                "profile_version": 1,
                "normalization_revision": "test-taxonomy-v1",
                "requested_components": [],
                "component_revisions": {},
            }
        )


def test_terminal_result_requires_uuidv4_and_transient_result_is_null() -> None:
    asset, descriptor = _asset_and_descriptor()
    profile = _profile()
    analysis_id = AnalysisRecord.make_analysis_id(asset, profile, descriptor)
    with pytest.raises(ContractError, match="UUIDv4"):
        AnalysisRecord(
            analysis_id=analysis_id,
            result_id="00000000-0000-1000-8000-000000000000",
            asset_id=asset.asset_id,
            expected_content_hash=asset.expected_content_hash,
            input_content_hash=None,
            observed_content_hash=None,
            analysis_profile=profile,
            analyser=descriptor,
            analysed_at=utc_now(),
            status="failed",
        )
    transient = AnalysisRecord(
        analysis_id=analysis_id,
        result_id=None,
        asset_id=asset.asset_id,
        expected_content_hash=asset.expected_content_hash,
        input_content_hash=None,
        observed_content_hash=None,
        analysis_profile=profile,
        analyser=descriptor,
        analysed_at=None,
        status="pending",
    )
    assert transient.to_dict()["result_id"] is None


def test_external_feature_storage_requires_complete_self_describing_descriptor() -> None:
    (
        asset,
        _,
    ) = _asset_and_descriptor()
    common = {
        "feature_id": "visual-feature:sha256:" + "d" * 64,
        "asset_id": asset.asset_id,
        "input_content_hash": asset.expected_content_hash,
        "feature_type": "image_embedding",
        "feature_model_id": "local/test",
        "feature_model_version": "1",
        "feature_extractor_revision": "test-l2-v1",
        "dimensions": 2,
        "similarity_family": "cosine",
        "normalization": {"kind": "l2", "applied": True},
        "generated_at": utc_now(),
        "values": None,
        "storage_reference": "visual-features/test.bin",
        "storage_format": "raw-vector-v1",
        "dtype": "float32",
        "byte_order": "little",
        "checksum": "sha256:" + "e" * 64,
    }
    feature = VisualFeature(**common)
    assert feature.storage_reference == "visual-features/test.bin"
    with pytest.raises(ContractError, match="checksum"):
        VisualFeature(**{**common, "checksum": None})


def _canonical_asset_record() -> dict[str, object]:
    digest = "sha256:" + "f" * 64
    return {
        "schema": "asset-record",
        "schema_version": 1,
        "asset_id": digest,
        "storage_locator": "/canonical/blob.png",
        "mime_type": "image/png",
        "size_bytes": 42,
        "content_hash": digest,
        "processing_state": "ready",
    }


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("schema", "other-record", "asset-record schema"),
        ("schema_version", 2, "schema version 1"),
        ("processing_state", "staged", "ready state"),
        ("asset_id", "not-a-hash", "asset record asset_id"),
    ],
)
def test_asset_record_validation_rejects_incompatible_or_malformed_input(
    field: str, value: object, message: str
) -> None:
    record = _canonical_asset_record()
    record[field] = value
    with pytest.raises(ContractError, match=message):
        AssetInput.from_asset_record(record)


def test_asset_record_validation_rejects_distinct_valid_asset_and_content_hashes() -> None:
    record = _canonical_asset_record()
    record["content_hash"] = "sha256:" + "a" * 64
    with pytest.raises(ContractError, match="asset_id must equal content_hash"):
        AssetInput.from_asset_record(record)


def test_asset_input_rejects_distinct_canonical_identity_and_expected_hash() -> None:
    with pytest.raises(ContractError, match="asset_id must equal expected_content_hash"):
        AssetInput(
            asset_id="sha256:" + "a" * 64,
            expected_content_hash="sha256:" + "b" * 64,
            storage_locator="/canonical/blob.png",
            mime_type="image/png",
        )
