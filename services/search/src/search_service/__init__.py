"""Persistent, provider-independent Search interfaces for Ollamabinsaden."""

from .analysis_adapter import visual_feature_input_from_analysis
from .models import (
    AssetNotIndexedError,
    AssetSearchState,
    ContractError,
    FeatureProfile,
    IndexStatus,
    IndexUnavailableError,
    SearchError,
    SimilarityResult,
    VisualFeatureInput,
)
from .service import VisualSearchService

__all__ = [
    "AssetNotIndexedError",
    "AssetSearchState",
    "ContractError",
    "FeatureProfile",
    "IndexStatus",
    "IndexUnavailableError",
    "SearchError",
    "SimilarityResult",
    "VisualFeatureInput",
    "VisualSearchService",
    "visual_feature_input_from_analysis",
]
