"""Permanent visual similarity retrieval service.

This module deliberately exposes canonical asset IDs and portable feature/model metadata,
not provider-specific index rows or model SDK objects.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from threading import RLock
from typing import Any, Self

import numpy as np

from .models import (
    AssetNotIndexedError,
    AssetSearchState,
    ContractError,
    FeatureProfile,
    IndexStatus,
    IndexUnavailableError,
    RelationshipType,
    SearchFilters,
    SimilarityResult,
    VisualFeatureInput,
)
from .store import StoredVector, VisualIndexStore


@dataclass(frozen=True)
class _IndexSnapshot:
    """In-process acceleration cache rebuilt from durable SQLite state as required."""

    rows: tuple[StoredVector, ...]
    normalised_matrix: Any
    index_version: str


class VisualSearchService:
    """Index and retrieve visually related canonical assets through stable contracts."""

    def __init__(
        self,
        database_path: str | Path,
        *,
        near_duplicate_threshold: float | None = None,
    ) -> None:
        if near_duplicate_threshold is not None and not -1.0 <= near_duplicate_threshold <= 1.0:
            raise ContractError("near_duplicate_threshold must be between -1 and 1")
        self._store = VisualIndexStore(database_path)
        self._near_duplicate_threshold = near_duplicate_threshold
        self._snapshots: dict[str, _IndexSnapshot] = {}
        self._lock = RLock()

    def close(self) -> None:
        self._store.close()

    def __enter__(self) -> Self:
        return self

    def __exit__(self, _exc_type: object, _exc: object, _traceback: object) -> None:
        self.close()

    def index_visual_feature(self, feature: VisualFeatureInput) -> bool:
        """Upsert a normalized visual feature into its isolated model/version partition.

        The operation is idempotent for the same asset, profile, feature metadata, and
        vector values. It returns ``True`` only if persisted derived index state changed.
        """
        changed = self._store.upsert(feature)
        if changed:
            self._drop_snapshot(feature.profile)
        return changed

    def remove_asset(self, asset_id: str, profile: FeatureProfile | None = None) -> int:
        """Remove one canonical asset from derived visual indexes."""
        removed = self._store.remove_asset(asset_id, profile)
        if removed:
            if profile is None:
                with self._lock:
                    self._snapshots.clear()
            else:
                self._drop_snapshot(profile)
        return removed

    def invalidate_asset(self, asset_id: str, profile: FeatureProfile, reason: str) -> bool:
        """Exclude a stale vector from retrieval pending authorised re-analysis/reindexing."""
        changed = self._store.invalidate_asset(asset_id, profile, reason)
        if changed:
            self._drop_snapshot(profile)
        return changed

    def find_visually_similar(
        self,
        asset_id: str,
        profile: FeatureProfile,
        *,
        limit: int = 20,
        filters: SearchFilters | None = None,
        include_seed: bool = False,
    ) -> list[SimilarityResult]:
        """Find nearest compatible visual neighbours for a canonical asset ID.

        No result is treated as proof of byte identity. Exact duplicate identity remains
        the responsibility of the canonical ingest/content-hash contract.
        """
        state = self.get_search_state(asset_id, profile)
        if state.state == "missing":
            raise AssetNotIndexedError(f"asset {asset_id} has no visual feature for {profile.index_id}")
        if state.state == "stale":
            raise AssetNotIndexedError(
                f"asset {asset_id} has a stale visual feature: {state.stale_reason}"
            )
        snapshot = self._snapshot(profile)
        seed_position = self._position_for_asset(snapshot, asset_id)
        if seed_position is None:
            raise AssetNotIndexedError(f"asset {asset_id} is not available in the active visual index")
        return self._rank(
            snapshot.normalised_matrix[seed_position],
            profile,
            limit=limit,
            filters=filters,
            exclude_asset_id=None if include_seed else asset_id,
        )

    def find_similar_vector(
        self,
        values: Sequence[float],
        profile: FeatureProfile,
        *,
        limit: int = 20,
        filters: SearchFilters | None = None,
    ) -> list[SimilarityResult]:
        """Find neighbours for an authorised feature vector in a compatible profile."""
        query = np.asarray(values, dtype=np.float32)
        if query.ndim != 1 or query.size != profile.dimension:
            raise ContractError("query vector dimensions do not match the feature profile")
        if not bool(np.isfinite(query).all()):
            raise ContractError("query vector values must be finite")
        norm = float(np.linalg.norm(query))
        if norm <= 0:
            raise ContractError("query vector norm must be positive")
        return self._rank(query / norm, profile, limit=limit, filters=filters, exclude_asset_id=None)

    def get_search_state(self, asset_id: str, profile: FeatureProfile) -> AssetSearchState:
        """Return indexed, stale, or missing state without conflating it with no-match."""
        return self._store.get_asset_state(asset_id, profile)

    def get_index_status(self, profile: FeatureProfile) -> IndexStatus:
        """Return health, profile metadata, counts, and derived storage location."""
        return self._store.get_status(profile)

    def health(self) -> dict[str, Any]:
        """Report process availability separately from health of persisted index profiles."""
        profiles = self._store.list_profiles()
        statuses = [self.get_index_status(profile).to_dict() for profile in profiles]
        has_degraded_profile = any(status["state"] == "degraded" for status in statuses)
        return {
            "service": "search",
            "service_status": "ready",
            "index_status": "degraded" if has_degraded_profile else "ready",
            "index_kind": "visual_similarity",
            "profiles": statuses,
        }

    def rebuild_index(self, profile: FeatureProfile) -> IndexStatus:
        """Validate durable vector rows and rebuild the in-process retrieval cache.

        Full recovery after database corruption is performed by calling
        :meth:`rebuild_from_features` with authorised analysis outputs.
        """
        status = self._store.rebuild_integrity(profile)
        self._drop_snapshot(profile)
        if status.active_vector_count:
            self._snapshot(profile)
        return status

    def rebuild_from_features(
        self, profile: FeatureProfile, features: Sequence[VisualFeatureInput]
    ) -> IndexStatus:
        """Atomically replace one derived profile from canonical analysis feature outputs."""
        status = self._store.replace_profile(profile, features)
        self._drop_snapshot(profile)
        if status.active_vector_count:
            self._snapshot(profile)
        return status

    def _drop_snapshot(self, profile: FeatureProfile) -> None:
        with self._lock:
            self._snapshots.pop(profile.partition_key, None)

    def _snapshot(self, profile: FeatureProfile) -> _IndexSnapshot:
        with self._lock:
            status = self._store.get_status(profile)
            cached = self._snapshots.get(profile.partition_key)
            if cached is not None and cached.index_version == status.index_version:
                return cached
            if status.active_vector_count == 0:
                raise IndexUnavailableError(
                    f"visual index {profile.index_id} has no active vectors; analysis may be pending"
                )
            rows = tuple(self._store.active_vectors(profile))
            try:
                matrix = np.vstack(
                    [
                        np.frombuffer(row.vector_blob, dtype=np.float32, count=profile.dimension)
                        for row in rows
                    ]
                )
                if matrix.shape != (len(rows), profile.dimension) or not bool(np.isfinite(matrix).all()):
                    raise ValueError("stored vectors are malformed")
                norms = np.linalg.norm(matrix, axis=1)
                if bool((norms <= 0).any()) or not bool(np.isfinite(norms).all()):
                    raise ValueError("stored vector norms are invalid")
            except (TypeError, ValueError) as error:
                self._store.rebuild_integrity(profile)
                raise IndexUnavailableError(
                    f"visual index {profile.index_id} contains invalid vectors; reindex required"
                ) from error
            snapshot = _IndexSnapshot(
                rows=rows,
                normalised_matrix=matrix / norms[:, None],
                index_version=status.index_version,
            )
            self._snapshots[profile.partition_key] = snapshot
            return snapshot

    @staticmethod
    def _position_for_asset(snapshot: _IndexSnapshot, asset_id: str) -> int | None:
        for position, row in enumerate(snapshot.rows):
            if row.asset_id == asset_id:
                return position
        return None

    def _rank(
        self,
        normalised_query: Any,
        profile: FeatureProfile,
        *,
        limit: int,
        filters: SearchFilters | None,
        exclude_asset_id: str | None,
    ) -> list[SimilarityResult]:
        if limit < 1:
            raise ContractError("limit must be at least one")
        snapshot = self._snapshot(profile)
        scores = snapshot.normalised_matrix @ normalised_query
        if not bool(np.isfinite(scores).all()):
            raise ContractError("calculated cosine similarity scores must be finite")
        scores = np.clip(scores, -1.0, 1.0)
        allowed_ids, excluded_ids = self._parse_filters(filters)
        candidates: list[tuple[float, StoredVector]] = []
        for score, row in zip(scores.tolist(), snapshot.rows, strict=True):
            if exclude_asset_id is not None and row.asset_id == exclude_asset_id:
                continue
            if row.asset_id in excluded_ids:
                continue
            if allowed_ids is not None and row.asset_id not in allowed_ids:
                continue
            candidates.append((float(score), row))
        candidates.sort(key=lambda item: (-item[0], item[1].asset_id))
        return [
            self._to_result(score, row, profile, snapshot.index_version)
            for score, row in candidates[:limit]
        ]

    @staticmethod
    def _parse_filters(filters: SearchFilters | None) -> tuple[set[str] | None, set[str]]:
        if filters is None:
            return None, set()
        supported = {"include_asset_ids", "exclude_asset_ids"}
        unexpected = set(filters).difference(supported)
        if unexpected:
            raise ContractError(f"unsupported visual filter(s): {', '.join(sorted(unexpected))}")

        def values_for(name: str) -> set[str]:
            raw = filters.get(name, [])
            values = [raw] if isinstance(raw, str) else list(raw)
            return {str(item) for item in values}

        included = values_for("include_asset_ids") if "include_asset_ids" in filters else None
        excluded = values_for("exclude_asset_ids")
        return included, excluded

    def _to_result(
        self, score: float, row: StoredVector, profile: FeatureProfile, index_version: str
    ) -> SimilarityResult:
        relationship: RelationshipType = "visually_similar"
        explanation = "Ranked by cosine similarity within a compatible visual feature profile."
        if self._near_duplicate_threshold is not None and score >= self._near_duplicate_threshold:
            relationship = "near_duplicate_candidate"
            explanation = (
                "Similarity meets the configured near-duplicate review threshold; "
                "byte identity remains unproven."
            )
        return SimilarityResult(
            asset_id=row.asset_id,
            content_hash=row.content_hash,
            score=score,
            relationship_type=relationship,
            profile=profile,
            index_version=index_version,
            analysis_id=row.analysis_id,
            analysis_result_id=row.analysis_result_id,
            explanation=explanation,
        )
