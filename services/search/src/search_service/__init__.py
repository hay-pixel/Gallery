"""Persistent, provider-independent Search interfaces for Ollamabinsaden."""

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
]
