"""Permanent visual similarity retrieval service.

This module deliberately exposes canonical asset IDs and portable feature/model metadata,
not provider-specific index rows or model SDK objects.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
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
    HybridComponent,
    HybridRanking,
    HybridSearchResult,
    IndexStatus,
    IndexUnavailableError,
    MatchedField,
    MetadataDocumentInput,
    MetadataSearchResult,
    RelationshipType,
    SearchFilters,
    SearchPage,
    SemanticAssetSearchState,
    SemanticEmbeddingInput,
    SemanticProfile,
    SemanticSearchResult,
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

    def index_metadata(self, doc: MetadataDocumentInput) -> bool:
        """Idempotently index canonical asset metadata and analysis fields."""
        return self._store.upsert_metadata(doc)

    def get_metadata(self, asset_id: str) -> MetadataDocumentInput | None:
        """Lookup indexed metadata document by canonical asset_id."""
        return self._store.get_metadata_document(asset_id)

    def search_metadata(
        self,
        query: str = "",
        filters: Mapping[str, Any] | None = None,
        *,
        limit: int = 50,
        cursor: str | None = None,
    ) -> SearchPage:
        """Deterministic metadata retrieval with matched-field explanations and cursor pagination."""
        if limit < 1:
            raise ContractError("limit must be at least one")
        docs = self._store.list_metadata_documents()
        clean_query = query.strip().lower()
        terms = [t for t in clean_query.split() if t]
        active_filters = dict(filters or {})

        matched_results: list[MetadataSearchResult] = []
        for doc in docs:
            fields = self._evaluate_metadata_match(doc, terms, active_filters)
            if fields is None:
                continue
            matched_results.append(
                MetadataSearchResult(
                    asset_id=doc.asset_id,
                    content_hash=doc.content_hash,
                    matched_fields=tuple(fields),
                    source_occurrences=tuple(doc.source_occurrences),
                    analysis_id=doc.analysis_id,
                    analysis_result_id=doc.analysis_result_id,
                )
            )

        start_idx = 0
        if cursor is not None and cursor.strip():
            cursor_id = cursor.strip()
            for idx, item in enumerate(matched_results):
                if item.asset_id > cursor_id:
                    start_idx = idx
                    break
            else:
                start_idx = len(matched_results)

        page_slice = matched_results[start_idx : start_idx + limit]
        has_more = (start_idx + limit) < len(matched_results)
        next_cursor = page_slice[-1].asset_id if (has_more and page_slice) else None
        return SearchPage(results=tuple(page_slice), next_cursor=next_cursor)

    @staticmethod
    def _evaluate_metadata_match(
        doc: MetadataDocumentInput,
        terms: list[str],
        filters: dict[str, Any],
    ) -> list[MatchedField] | None:
        matched: list[MatchedField] = []

        if "asset_id" in filters:
            req_id = str(filters["asset_id"]).strip()
            if doc.asset_id != req_id:
                return None
            matched.append(MatchedField("asset_id", doc.asset_id, "exact", 1.0))

        if "mime_type" in filters:
            req_mime = str(filters["mime_type"]).strip().lower()
            if doc.mime_type.lower() != req_mime:
                return None
            matched.append(MatchedField("mime_type", doc.mime_type, "exact", 1.0))

        if "source_kind" in filters:
            req_kind = str(filters["source_kind"]).strip().lower()
            occ_kinds = {
                (occ.source_kind or "").lower()
                for occ in doc.source_occurrences
                if occ.source_kind
            }
            if doc.source_kind.lower() != req_kind and req_kind not in occ_kinds:
                return None
            matched.append(MatchedField("source_kind", req_kind, "exact", 1.0))

        if "source_location" in filters:
            req_loc = str(filters["source_location"]).strip()
            occ_locs = {
                occ.source_location
                for occ in doc.source_occurrences
                if occ.source_location
            }
            if doc.source_location != req_loc and req_loc not in occ_locs:
                return None
            matched.append(MatchedField("source_location", req_loc, "exact", 1.0))

        if "category" in filters:
            req_cat = str(filters["category"]).strip().lower()
            doc_cats = {doc.category.lower(), *(c.lower() for c in doc.categories)}
            if req_cat not in doc_cats:
                return None
            matched.append(MatchedField("category", doc.category, "exact", 1.0))

        if "tag" in filters:
            req_tag = str(filters["tag"]).strip().lower()
            if req_tag not in doc.tags:
                return None
            matched.append(MatchedField("analysis.tags", req_tag, "exact", 1.0))

        if "analysis_status" in filters:
            req_status = str(filters["analysis_status"]).strip().lower()
            if doc.analysis_status.lower() != req_status:
                return None
            matched.append(MatchedField("analysis.status", doc.analysis_status, "exact", 1.0))

        if "min_size_bytes" in filters:
            if doc.size_bytes < int(filters["min_size_bytes"]):
                return None
            matched.append(MatchedField("size_bytes", str(doc.size_bytes), "range", 1.0))

        if "max_size_bytes" in filters:
            if doc.size_bytes > int(filters["max_size_bytes"]):
                return None
            matched.append(MatchedField("size_bytes", str(doc.size_bytes), "range", 1.0))

        for term in terms:
            term_matched = False
            if term in doc.original_path.lower() or any(
                term in occ.original_path.lower() for occ in doc.source_occurrences
            ):
                matched.append(MatchedField("original_path", doc.original_path, "substring", 1.0))
                term_matched = True
            for t in doc.tags:
                if term == t or term in t:
                    matched.append(
                        MatchedField(
                            "analysis.tags",
                            t,
                            "exact" if term == t else "substring",
                            1.0,
                        )
                    )
                    term_matched = True
                    break
            if term in doc.category.lower() or (
                doc.subcategory and term in doc.subcategory.lower()
            ):
                matched.append(MatchedField("category", doc.category, "substring", 1.0))
                term_matched = True
            if doc.ocr_text and term in doc.ocr_text.lower():
                matched.append(MatchedField("ocr_text", doc.ocr_text[:120], "substring", 1.0))
                term_matched = True
            if doc.summary and term in doc.summary.lower():
                matched.append(MatchedField("analysis.summary", doc.summary[:120], "substring", 1.0))
                term_matched = True
            if not term_matched:
                return None

        if not matched:
            matched.append(MatchedField("asset_id", doc.asset_id, "exact", 1.0))
        return matched

    def index_semantic_embedding(self, embedding: SemanticEmbeddingInput) -> bool:
        """Upsert a normalized semantic embedding into its isolated model/version partition."""
        return self._store.upsert_semantic(embedding)

    def invalidate_semantic_asset(
        self, asset_id: str, profile: SemanticProfile, reason: str
    ) -> bool:
        """Mark a semantic embedding stale pending re-embedding."""
        return self._store.invalidate_semantic_asset(asset_id, profile, reason)

    def get_semantic_state(
        self, asset_id: str, profile: SemanticProfile
    ) -> SemanticAssetSearchState:
        """Return indexed, stale, or missing state for a semantic embedding."""
        return self._store.get_semantic_asset_state(asset_id, profile)

    def search_semantic_vector(
        self,
        values: Sequence[float],
        profile: SemanticProfile,
        *,
        filters: Mapping[str, Any] | None = None,
        limit: int = 20,
    ) -> list[SemanticSearchResult]:
        """Rank semantic embeddings within a compatible SemanticProfile."""
        if limit < 1:
            raise ContractError("limit must be at least one")
        query = np.asarray(values, dtype=np.float32)
        if query.ndim != 1 or query.size != profile.dimension:
            raise ContractError("query vector dimensions do not match the semantic profile")
        if not bool(np.isfinite(query).all()):
            raise ContractError("query vector values must be finite")
        norm = float(np.linalg.norm(query))
        if norm <= 0:
            raise ContractError("query vector norm must be positive")
        norm_query = query / norm

        rows, index_version = self._store.active_semantic_vectors(profile)
        if not rows:
            return []

        allowed_ids: set[str] | None = None
        if filters:
            meta_page = self.search_metadata(filters=filters, limit=10000)
            allowed_ids = {r.asset_id for r in meta_page.results}

        matrix = np.vstack(
            [
                np.frombuffer(row.vector_blob, dtype=np.float32, count=profile.dimension)
                / row.vector_norm
                for row in rows
            ]
        )
        scores = np.clip(matrix @ norm_query, -1.0, 1.0)
        candidates = []
        for score, row in zip(scores.tolist(), rows, strict=True):
            if allowed_ids is not None and row.asset_id not in allowed_ids:
                continue
            candidates.append((float(score), row))
        candidates.sort(key=lambda item: (-item[0], item[1].asset_id))

        results: list[SemanticSearchResult] = []
        for score, row in candidates[:limit]:
            meta_doc = self._store.get_metadata_document(row.asset_id)
            occurrences = tuple(meta_doc.source_occurrences) if meta_doc else ()
            results.append(
                SemanticSearchResult(
                    asset_id=row.asset_id,
                    content_hash=row.content_hash,
                    score=score,
                    profile=profile,
                    index_version=index_version,
                    semantic_input_revision=row.semantic_input_revision,
                    analysis_id=row.analysis_id,
                    analysis_result_id=row.analysis_result_id,
                    source_occurrences=occurrences,
                    explanation="Matched semantic embedding input derived from tags, OCR, and summary.",
                )
            )
        return results

    def search_hybrid(
        self,
        *,
        query: str = "",
        filters: Mapping[str, Any] | None = None,
        semantic_vector: Sequence[float] | None = None,
        semantic_profile: SemanticProfile | None = None,
        visual_seed_asset_id: str | None = None,
        visual_profile: FeatureProfile | None = None,
        weights: Mapping[str, float] | None = None,
        limit: int = 20,
    ) -> list[HybridSearchResult]:
        """Execute hybrid retrieval with deterministic pre-filtering and normalized component weights."""
        if limit < 1:
            raise ContractError("limit must be at least one")

        default_weights = {
            "semantic": 0.5,
            "visual_similarity": 0.3,
            "metadata": 0.2,
        }
        if weights:
            default_weights.update({k: float(v) for k, v in weights.items()})

        has_meta_filter = bool(query.strip() or filters)
        meta_matches: dict[str, MetadataSearchResult] = {}
        if has_meta_filter:
            meta_page = self.search_metadata(query=query, filters=filters, limit=10000)
            for item in meta_page.results:
                meta_matches[item.asset_id] = item
            if not meta_matches:
                return []

        semantic_matches: dict[str, SemanticSearchResult] = {}
        if semantic_vector is not None and semantic_profile is not None:
            for item in self.search_semantic_vector(
                semantic_vector, semantic_profile, filters=None, limit=10000
            ):
                if not has_meta_filter or item.asset_id in meta_matches:
                    semantic_matches[item.asset_id] = item

        visual_matches: dict[str, SimilarityResult] = {}
        if visual_seed_asset_id is not None and visual_profile is not None:
            for item in self.find_visually_similar(
                visual_seed_asset_id, visual_profile, limit=10000
            ):
                if not has_meta_filter or item.asset_id in meta_matches:
                    visual_matches[item.asset_id] = item

        candidate_ids: set[str] = set()
        if has_meta_filter:
            candidate_ids.update(meta_matches.keys())
            if semantic_matches or visual_matches:
                vector_ids = set(semantic_matches.keys()) | set(visual_matches.keys())
                candidate_ids &= vector_ids
        else:
            candidate_ids.update(semantic_matches.keys())
            candidate_ids.update(visual_matches.keys())

        hybrid_results: list[HybridSearchResult] = []
        for aid in candidate_ids:
            raw_components: list[tuple[str, HybridComponent]] = []
            if aid in semantic_matches:
                sem = semantic_matches[aid]
                norm_sem = max(0.0, min(1.0, (sem.score + 1.0) / 2.0))
                raw_components.append(
                    (
                        "semantic",
                        HybridComponent(
                            retrieval_mode="semantic",
                            relationship_type="semantically_related",
                            raw_score=sem.score,
                            score_kind="cosine_similarity",
                            normalized_score=norm_sem,
                            weight=default_weights["semantic"],
                            model=sem.profile.to_dict(),
                            index_id=sem.profile.index_id,
                            index_version=sem.index_version,
                            analysis_id=sem.analysis_id,
                            analysis_result_id=sem.analysis_result_id,
                        ),
                    )
                )
            if aid in visual_matches:
                vis = visual_matches[aid]
                norm_vis = max(0.0, min(1.0, (vis.score + 1.0) / 2.0))
                raw_components.append(
                    (
                        "visual_similarity",
                        HybridComponent(
                            retrieval_mode="visual_similarity",
                            relationship_type=vis.relationship_type,
                            raw_score=vis.score,
                            score_kind="cosine_similarity",
                            normalized_score=norm_vis,
                            weight=default_weights["visual_similarity"],
                            model=vis.profile.to_dict(),
                            index_id=vis.profile.index_id,
                            index_version=vis.index_version,
                            analysis_id=vis.analysis_id,
                            analysis_result_id=vis.analysis_result_id,
                        ),
                    )
                )
            if aid in meta_matches:
                meta = meta_matches[aid]
                raw_components.append(
                    (
                        "metadata",
                        HybridComponent(
                            retrieval_mode="metadata",
                            relationship_type="metadata_match",
                            raw_score=1.0,
                            score_kind="boolean_filter_match",
                            normalized_score=1.0,
                            weight=default_weights["metadata"],
                            model=None,
                            index_id=meta.index_id,
                            index_version=meta.index_version,
                            analysis_id=meta.analysis_id,
                            analysis_result_id=meta.analysis_result_id,
                        ),
                    )
                )

            if not raw_components:
                continue

            total_weight = sum(comp.weight for _, comp in raw_components)
            if total_weight <= 0:
                total_weight = 1.0

            normalized_components: list[HybridComponent] = []
            final_score = 0.0
            for _, comp in raw_components:
                effective_weight = comp.weight / total_weight
                contrib = comp.normalized_score * effective_weight
                final_score += contrib
                normalized_components.append(
                    HybridComponent(
                        retrieval_mode=comp.retrieval_mode,
                        relationship_type=comp.relationship_type,
                        raw_score=comp.raw_score,
                        score_kind=comp.score_kind,
                        normalized_score=comp.normalized_score,
                        weight=effective_weight,
                        model=comp.model,
                        index_id=comp.index_id,
                        index_version=comp.index_version,
                        analysis_id=comp.analysis_id,
                        analysis_result_id=comp.analysis_result_id,
                    )
                )

            meta_doc = self._store.get_metadata_document(aid)
            occurrences = tuple(meta_doc.source_occurrences) if meta_doc else ()
            hybrid_results.append(
                HybridSearchResult(
                    asset_id=aid,
                    content_hash=aid,
                    score=final_score,
                    components=tuple(normalized_components),
                    ranking=HybridRanking(final_score=final_score),
                    relationship_type="semantically_related"
                    if aid in semantic_matches
                    else (
                        visual_matches[aid].relationship_type
                        if aid in visual_matches
                        else "metadata_match"
                    ),
                    source_occurrences=occurrences,
                    explanation="Combined family-normalized component scores with deterministic filter pushdown.",
                )
            )

        hybrid_results.sort(key=lambda item: (-item.score, item.asset_id))
        return hybrid_results[:limit]
