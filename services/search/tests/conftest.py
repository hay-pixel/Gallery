from __future__ import annotations

import hashlib

import pytest

from search_service import FeatureProfile, VisualFeatureInput


def canonical_id(label: str) -> str:
    return f"sha256:{hashlib.sha256(label.encode()).hexdigest()}"


@pytest.fixture
def profile() -> FeatureProfile:
    return FeatureProfile(
        feature_type="image_embedding",
        feature_model_id="fixture-vision",
        feature_model_version="1.0.0",
        feature_extractor_revision="fixture-extractor-v1",
        dimensions=4,
        similarity_family="cosine",
        normalization={"kind": "l2", "applied": False},
    )


def feature(
    label: str,
    values: list[float],
    profile: FeatureProfile,
    *,
    revision: str = "analysis-fixture-v1",
    analysis_id: str | None = "analysis:fixture-logical-v1",
    analysis_result_id: str | None = "analysis-result:fixture-terminal-v1",
) -> VisualFeatureInput:
    asset_id = canonical_id(label)
    return VisualFeatureInput(
        asset_id=asset_id,
        input_content_hash=asset_id,
        profile=profile,
        values=values,
        feature_id=f"visual-feature:{label}:{revision}",
        analysis_id=analysis_id,
        analysis_result_id=analysis_result_id,
        generated_at="2026-08-25T00:00:00Z",
    )
