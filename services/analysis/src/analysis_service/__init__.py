"""Permanent, provider-independent visual analysis for canonical assets."""

from .backends import BackendUnavailable, TesseractOcrBackend, TorchvisionResNet18Backend
from .models import (
    AnalysisProfile,
    AnalysisRecord,
    AssetInput,
    OcrResult,
    RuntimeDescriptor,
    VisualFeature,
)
from .service import AnalysisOutcome, AnalysisService

__all__ = [
    "AnalysisOutcome",
    "AnalysisProfile",
    "AnalysisRecord",
    "AnalysisService",
    "AssetInput",
    "BackendUnavailable",
    "OcrResult",
    "RuntimeDescriptor",
    "TesseractOcrBackend",
    "TorchvisionResNet18Backend",
    "VisualFeature",
]
