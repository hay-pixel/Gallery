"""Search-owned adapter for serialized project VisualFeature v1 records.

This module intentionally consumes only dictionaries/JSON.  Production Search never imports
``analysis_service`` or calls Analysis implementation objects directly.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from .models import ContractError, FeatureProfile, VisualFeatureInput


def _required_string(payload: Mapping[str, Any], name: str) -> str:
    value = payload.get(name)
    if not isinstance(value, str) or not value.strip():
        raise ContractError(f"Analysis VisualFeature {name} must be a non-empty string")
    return value


def visual_feature_input_from_analysis(payload: Mapping[str, Any]) -> VisualFeatureInput:
    """Validate one inline, whole-image Analysis VisualFeature v1 for Search indexing."""
    if not isinstance(payload, Mapping):
        raise ContractError("Analysis VisualFeature payload must be an object")
    schema_version = payload.get("schema_version")
    if (
        payload.get("schema") != "visual-feature"
        or not isinstance(schema_version, int)
        or isinstance(schema_version, bool)
        or schema_version != 1
    ):
        raise ContractError("only integer Analysis visual-feature schema version 1 is supported")
    values = payload.get("values")
    if values is None and payload.get("storage_reference") is not None:
        raise ContractError("external Analysis feature payload decoding is not implemented")
    if not isinstance(values, list):
        raise ContractError("Analysis VisualFeature values must be an inline array")
    try:
        values = [float(value) for value in values]
    except (TypeError, ValueError) as error:
        raise ContractError("Analysis VisualFeature values must contain finite numeric elements") from error
    if payload.get("scope") != "whole_image":
        raise ContractError("only whole_image Analysis VisualFeatures are supported")
    dimensions = payload.get("dimensions")
    if not isinstance(dimensions, int) or isinstance(dimensions, bool):
        raise ContractError("Analysis VisualFeature dimensions must be a positive integer")
    normalization = payload.get("normalization")
    if not isinstance(normalization, Mapping):
        raise ContractError("Analysis VisualFeature normalization must be an object")
    _required_string(payload, "analysis_profile_id")
    _required_string(payload, "analysis_profile_version")
    profile = FeatureProfile(
        feature_type=_required_string(payload, "feature_type"),
        feature_model_id=_required_string(payload, "feature_model_id"),
        feature_model_version=_required_string(payload, "feature_model_version"),
        feature_extractor_revision=_required_string(payload, "feature_extractor_revision"),
        dimensions=dimensions,
        similarity_family=_required_string(payload, "similarity_family"),  # type: ignore[arg-type]
        normalization=dict(normalization),
    )
    return VisualFeatureInput(
        asset_id=_required_string(payload, "asset_id"),
        input_content_hash=_required_string(payload, "input_content_hash"),
        profile=profile,
        values=values,
        feature_id=_required_string(payload, "feature_id"),
        analysis_id=_required_string(payload, "analysis_id"),
        analysis_result_id=_required_string(payload, "result_id"),
        generated_at=_required_string(payload, "generated_at"),
        schema="visual-feature",
        schema_version=1,
    )
