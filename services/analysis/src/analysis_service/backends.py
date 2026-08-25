"""Deployable local-analysis backends with no external per-asset inference calls."""

from __future__ import annotations

import math
import os
import warnings
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

from PIL import Image, UnidentifiedImageError

from .models import ConfidenceLabel, RuntimeDescriptor


class BackendUnavailable(RuntimeError):
    """Raised when an optional local model/runtime cannot be loaded."""


class UnsupportedMedia(ValueError):
    """Raised when a canonical blob is not a supported image."""


_PIL_IMAGE_ERRORS = (
    Image.DecompressionBombError,
    Image.DecompressionBombWarning,
    UnidentifiedImageError,
    OSError,
)


@contextmanager
def temporary_torch_home(cache_dir: str | Path | None) -> Iterator[None]:
    """Make an explicit analysis cache authoritative only while weights are initialized."""
    if cache_dir is None:
        yield
        return
    previous = os.environ.get("TORCH_HOME")
    os.environ["TORCH_HOME"] = str(cache_dir)
    try:
        yield
    finally:
        if previous is None:
            os.environ.pop("TORCH_HOME", None)
        else:
            os.environ["TORCH_HOME"] = previous


def _open_rgb_image(path: Path) -> Image.Image:
    """Decode an image under Pillow's safety limits and return an independent RGB copy."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(path) as image:
                return image.convert("RGB")
    except _PIL_IMAGE_ERRORS as exc:
        raise UnsupportedMedia(f"unable to decode supported image bytes: {exc}") from exc


@dataclass(frozen=True)
class FeatureSpec:
    """Complete project-owned visual-vector compatibility metadata."""

    feature_type: str
    feature_model_id: str
    feature_model_version: str
    feature_extractor_revision: str
    similarity_family: str
    normalization: dict[str, Any]


@dataclass(frozen=True)
class VisualObservation:
    """Ephemeral normalized backend output, never a raw SDK response."""

    labels: list[ConfidenceLabel]
    feature_values: list[float]


class VisualBackend(Protocol):
    """Boundary that permits approved model replacement without consumer changes."""

    @property
    def descriptor(self) -> RuntimeDescriptor: ...

    @property
    def feature_spec(self) -> FeatureSpec: ...

    def analyse_image(self, path: Path, source_content_hash: str) -> VisualObservation: ...


class OcrBackend(Protocol):
    """Optional local text-detection boundary."""

    @property
    def engine(self) -> dict[str, str]: ...

    def detect(self, path: Path) -> list[ConfidenceLabel]: ...


class TorchvisionResNet18Backend:
    """Local ImageNet classifier with a 512-dimensional L2-normalized feature.

    The initial backend is intentionally CPU-first. A controlled install/cache
    priming step obtains model weights; normal analysis uses only the local model
    cache and never sends an image to an external inference provider.
    """

    MODEL_ID = "torchvision/resnet18"
    MODEL_VERSION = "imagenet1k-v1"
    FEATURE_EXTRACTOR_REVISION = "resnet18-rgb-224-center-crop-avgpool-l2-v1"

    def __init__(self, *, cache_dir: str | Path | None = None, top_k: int = 5) -> None:
        try:
            import torch
            import torchvision  # type: ignore[import-untyped]
            from torchvision.models import (  # type: ignore[import-untyped]
                ResNet18_Weights,
                resnet18,
            )
        except ImportError as exc:
            raise BackendUnavailable(
                "torchvision runtime is unavailable; install services/analysis[runtime] and prime weights"
            ) from exc
        self._torch = torch
        self._top_k = top_k
        try:
            with temporary_torch_home(cache_dir):
                self._weights = ResNet18_Weights.IMAGENET1K_V1
                self._model = resnet18(weights=self._weights).eval()
        except Exception as exc:
            raise BackendUnavailable(
                "could not load local ResNet-18 ImageNet weights; prime the configured model cache before use"
            ) from exc
        self._categories = list(self._weights.meta["categories"])
        self._preprocess = self._weights.transforms()
        self._descriptor = RuntimeDescriptor(
            runtime_id="python/torchvision",
            runtime_version=str(torchvision.__version__),
            model_id=self.MODEL_ID,
            model_version=self.MODEL_VERSION,
            device_class="cpu",
        )
        self._feature_spec = FeatureSpec(
            feature_type="image_embedding",
            feature_model_id=self.MODEL_ID,
            feature_model_version=self.MODEL_VERSION,
            feature_extractor_revision=self.FEATURE_EXTRACTOR_REVISION,
            similarity_family="cosine",
            normalization={"kind": "l2", "applied": True},
        )

    @property
    def descriptor(self) -> RuntimeDescriptor:
        return self._descriptor

    @property
    def feature_spec(self) -> FeatureSpec:
        return self._feature_spec

    def _feature_and_logits(self, batch: Any) -> tuple[Any, Any]:
        """Evaluate ResNet layers once, retaining the pre-classifier feature vector."""
        model = self._model
        x = model.conv1(batch)
        x = model.bn1(x)
        x = model.relu(x)
        x = model.maxpool(x)
        x = model.layer1(x)
        x = model.layer2(x)
        x = model.layer3(x)
        x = model.layer4(x)
        x = model.avgpool(x)
        features = self._torch.flatten(x, 1)
        return features, model.fc(features)

    def analyse_image(self, path: Path, source_content_hash: str) -> VisualObservation:
        rgb = _open_rgb_image(path)
        batch = self._preprocess(rgb).unsqueeze(0)
        with self._torch.inference_mode():
            features, logits = self._feature_and_logits(batch)
            probabilities = self._torch.softmax(logits[0], dim=0)
            scores, indexes = self._torch.topk(probabilities, k=self._top_k)
            vector = features[0]
            vector = vector / self._torch.linalg.vector_norm(vector).clamp_min(1e-12)

        labels = [
            ConfidenceLabel(
                label=self._categories[int(index)], confidence=float(score), source="classifier"
            )
            for score, index in zip(scores.tolist(), indexes.tolist(), strict=True)
        ]
        return VisualObservation(
            labels=labels,
            feature_values=[round(float(value), 8) for value in vector.tolist()],
        )


class TesseractOcrBackend:
    """Optional local OCR adapter; requires the system `tesseract` executable."""

    def __init__(self, *, minimum_confidence: float = 0.45) -> None:
        try:
            import pytesseract  # type: ignore[import-not-found]
        except ImportError as exc:
            raise BackendUnavailable(
                "pytesseract is unavailable; install services/analysis[ocr]"
            ) from exc
        try:
            version = str(pytesseract.get_tesseract_version())
        except Exception as exc:
            raise BackendUnavailable("the local tesseract executable is unavailable") from exc
        self._pytesseract = pytesseract
        self._minimum_confidence = minimum_confidence
        self._engine = {"engine_id": "tesseract", "engine_version": version}

    @property
    def engine(self) -> dict[str, str]:
        return self._engine

    def detect(self, path: Path) -> list[ConfidenceLabel]:
        image = _open_rgb_image(path)
        data = self._pytesseract.image_to_data(image, output_type=self._pytesseract.Output.DICT)
        labels: list[ConfidenceLabel] = []
        for text, confidence in zip(data["text"], data["conf"], strict=True):
            normalized_text = str(text).strip()
            try:
                score = float(confidence) / 100.0
            except (TypeError, ValueError):
                continue
            if normalized_text and score >= self._minimum_confidence:
                labels.append(
                    ConfidenceLabel(
                        label=normalized_text,
                        confidence=max(0.0, min(score, 1.0)),
                        source="ocr",
                    )
                )
        return labels


def is_decodable_image(path: Path) -> bool:
    """Perform a safety-limited decode check instead of trusting extension or MIME hints."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(path) as image:
                image.verify()
        return True
    except _PIL_IMAGE_ERRORS:
        return False


def vector_norm(values: list[float]) -> float:
    """Small utility for tests and operational diagnostics."""
    return math.sqrt(sum(value * value for value in values))
