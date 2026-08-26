from __future__ import annotations

import ast
import math
from pathlib import Path

import pytest

from search_service import ContractError, visual_feature_input_from_analysis


def _payload() -> dict[str, object]:
    return {
        "schema": "visual-feature", "schema_version": 1, "feature_id": "feature-1",
        "asset_id": "sha256:" + "a" * 64, "input_content_hash": "sha256:" + "a" * 64,
        "feature_type": "image_embedding", "feature_model_id": "fixture", "feature_model_version": "1",
        "feature_extractor_revision": "fixture-v1", "dimensions": 2, "similarity_family": "cosine",
        "normalization": {"kind": "l2", "applied": True}, "values": [1.0, 0.0],
        "generated_at": "2026-08-26T00:00:00Z", "analysis_id": "analysis:fixture",
        "result_id": "123e4567-e89b-42d3-a456-426614174000", "analysis_profile_id": "image-default",
        "analysis_profile_version": "1", "scope": "whole_image",
    }


@pytest.mark.parametrize("field,value", [("schema_version", 2), ("analysis_id", ""), ("result_id", ""), ("feature_extractor_revision", ""), ("dimensions", 3), ("similarity_family", "dot_product"), ("scope", "frame")])
def test_adapter_rejects_ineligible_analysis_features(field, value):
    payload = _payload()
    payload[field] = value
    with pytest.raises(ContractError):
        visual_feature_input_from_analysis(payload)


def test_adapter_rejects_hash_mismatch_nonfinite_zero_and_external_only_vectors():
    payload = _payload()
    payload["input_content_hash"] = "sha256:" + "b" * 64
    with pytest.raises(ContractError):
        visual_feature_input_from_analysis(payload)
    payload = _payload()
    payload["values"] = [math.nan, 0.0]
    with pytest.raises(ContractError):
        visual_feature_input_from_analysis(payload)
    payload = _payload()
    payload["values"] = [0.0, 0.0]
    with pytest.raises(ContractError):
        visual_feature_input_from_analysis(payload)
    payload = _payload()
    payload["values"] = None
    payload["storage_reference"] = "visual-features/feature.bin"
    with pytest.raises(ContractError, match="external"):
        visual_feature_input_from_analysis(payload)


def test_search_production_code_does_not_import_analysis_implementation():
    source_root = Path(__file__).parents[1] / "src"
    imports: list[str] = []
    for path in source_root.rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Import):
                imports.extend(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imports.append(node.module)
    assert "analysis" + "_service" not in imports


@pytest.mark.parametrize("field,value", [
    ("analysis_profile_id", None),
    ("analysis_profile_id", ""),
    ("analysis_profile_version", None),
    ("analysis_profile_version", ""),
])
def test_adapter_requires_analysis_profile_provenance(field, value):
    payload = _payload()
    if value is None:
        payload.pop(field)
    else:
        payload[field] = value
    with pytest.raises(ContractError, match=field):
        visual_feature_input_from_analysis(payload)


@pytest.mark.parametrize("value", [None, {}, "banana"])
def test_adapter_normalises_malformed_vector_elements(value):
    payload = _payload()
    payload["values"] = [value, 1.0]
    with pytest.raises(ContractError, match="numeric"):
        visual_feature_input_from_analysis(payload)


@pytest.mark.parametrize("value", [True, False, 1.0, "1", None, 2])
def test_adapter_rejects_non_integer_schema_version(value):
    payload = _payload()
    payload["schema_version"] = value
    with pytest.raises(ContractError, match="integer"):
        visual_feature_input_from_analysis(payload)


def test_adapter_accepts_integer_schema_version_one():
    assert visual_feature_input_from_analysis(_payload()).schema_version == 1


def test_cli_returns_typed_error_for_malformed_analysis_vector(tmp_path, capsys):
    from search_service.cli import main

    feature_path = tmp_path / "feature.json"
    payload = _payload()
    payload["values"] = [None, 1.0]
    feature_path.write_text(__import__("json").dumps(payload))
    assert main(["--database", str(tmp_path / "search.sqlite3"), "index-analysis-feature", "--feature-json", str(feature_path)]) == 2
    assert '"status": "unavailable"' in capsys.readouterr().out
