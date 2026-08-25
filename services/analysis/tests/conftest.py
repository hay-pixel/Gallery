from __future__ import annotations

import hashlib
from pathlib import Path

import pytest
from PIL import Image, ImageDraw

from analysis_service.backends import FeatureSpec, VisualObservation
from analysis_service.models import AssetInput, ConfidenceLabel, RuntimeDescriptor


class StubVisualBackend:
    """Deterministic local test backend; no production model or network is involved."""

    def __init__(self) -> None:
        self.calls = 0
        self._descriptor = RuntimeDescriptor(
            runtime_id="test/local-vision",
            runtime_version="1.0.0",
            model_id="test/fixture-classifier",
            model_version="2026-08-25",
            device_class="cpu",
        )
        self._feature_spec = FeatureSpec(
            feature_type="image_embedding",
            feature_model_id="test/fixture-classifier",
            feature_model_version="2026-08-25",
            feature_extractor_revision="test-rgb-96x64-l2-v1",
            similarity_family="cosine",
            normalization={"kind": "l2", "applied": True},
        )

    @property
    def descriptor(self) -> RuntimeDescriptor:
        return self._descriptor

    @property
    def feature_spec(self) -> FeatureSpec:
        return self._feature_spec

    def analyse_image(self, path: Path, source_content_hash: str) -> VisualObservation:
        self.calls += 1
        return VisualObservation(
            labels=[
                ConfidenceLabel("sports car", 0.92, "classifier"),
                ConfidenceLabel("golden retriever", 0.31, "classifier"),
                ConfidenceLabel("dining table", 0.04, "classifier"),
            ],
            feature_values=[0.0, 0.6, 0.0, 0.8],
        )


@pytest.fixture
def canonical_image(tmp_path: Path) -> tuple[Path, AssetInput]:
    path = tmp_path / "canonical-image.png"
    image = Image.new("RGB", (96, 64), "#dfe9f5")
    draw = ImageDraw.Draw(image)
    draw.rectangle((8, 28, 72, 52), fill="#dc3545")
    draw.ellipse((16, 44, 32, 60), fill="#202020")
    draw.ellipse((52, 44, 68, 60), fill="#202020")
    image.save(path, format="PNG")
    digest = f"sha256:{hashlib.sha256(path.read_bytes()).hexdigest()}"
    return path, AssetInput(
        asset_id=digest,
        expected_content_hash=digest,
        storage_locator=str(path),
        mime_type="image/png",
    )


@pytest.fixture
def stub_backend() -> StubVisualBackend:
    return StubVisualBackend()
