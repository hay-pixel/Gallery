"""Tests for Complete Search (Milestone 2): Metadata, Semantic, and Hybrid retrieval.

Conforms to docs/contracts/SEARCH.md and tests/contracts/search_result_contract.md.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from conftest import canonical_id, feature

from search_service import (
    AssetNotIndexedError,
    ContractError,
    FeatureProfile,
    IndexUnavailableError,
    MetadataDocumentInput,
    SemanticEmbeddingInput,
    SemanticProfile,
    SourceOccurrenceProvenance,
    VisualSearchService,
)


@pytest.fixture
def semantic_profile() -> SemanticProfile:
    return SemanticProfile(
        model_id="nomic-embed-text",
        model_version="1.5",
        dimension=4,
    )


def test_metadata_search_exact_and_filter_matches_with_provenance(tmp_path: Path) -> None:
    db = tmp_path / "search.sqlite3"
    car_id = canonical_id("car-beach")
    receipt_id = canonical_id("fuel-receipt")

    occ_camera = SourceOccurrenceProvenance(
        source_occurrence_id=f"occurrence:{canonical_id('occ-1')}",
        source_id="source:camera",
        original_path="camera/IMG_001.jpg",
        source_kind="camera",
        source_location="/media/camera",
    )
    occ_backup = SourceOccurrenceProvenance(
        source_occurrence_id=f"occurrence:{canonical_id('occ-2')}",
        source_id="source:backup",
        original_path="backup/IMG_001_copy.jpg",
        source_kind="local_folder",
        source_location="/media/backup",
    )
    occ_docs = SourceOccurrenceProvenance(
        source_occurrence_id=f"occurrence:{canonical_id('occ-3')}",
        source_id="source:docs",
        original_path="docs/fuel_october.pdf",
        source_kind="local_folder",
        source_location="/media/docs",
    )

    doc_car = MetadataDocumentInput(
        asset_id=car_id,
        content_hash=car_id,
        mime_type="image/jpeg",
        size_bytes=204800,
        original_path="camera/IMG_001.jpg",
        source_kind="camera",
        source_location="/media/camera",
        category="Photos",
        subcategory="Vehicles",
        tags=("car", "beach", "red"),
        ocr_text="",
        summary="Red car parked near the beach",
        analysis_status="ready",
        analysis_id="analysis:logical:car",
        analysis_result_id="analysis-result:car-v1",
        source_occurrences=(occ_camera, occ_backup),
    )
    doc_receipt = MetadataDocumentInput(
        asset_id=receipt_id,
        content_hash=receipt_id,
        mime_type="application/pdf",
        size_bytes=40960,
        original_path="docs/fuel_october.pdf",
        source_kind="local_folder",
        source_location="/media/docs",
        category="Documents",
        tags=("receipt", "fuel"),
        ocr_text="TOTAL FUEL $84.50 SYDNEY",
        summary="October fuel receipt",
        analysis_status="ready",
        analysis_id="analysis:logical:receipt",
        analysis_result_id="analysis-result:receipt-v1",
        source_occurrences=(occ_docs,),
    )

    with VisualSearchService(db) as service:
        assert service.index_metadata(doc_car) is True
        # Idempotent re-index
        assert service.index_metadata(doc_car) is False
        assert service.index_metadata(doc_receipt) is True

        # 1. Filter by tag and mime_type
        page = service.search_metadata(
            query="beach",
            filters={"mime_type": "image/jpeg", "tag": "car"},
        )
        assert len(page.results) == 1
        assert page.next_cursor is None
        res_dict = page.results[0].to_dict()
        assert res_dict["asset_id"] == car_id
        assert res_dict["content_hash"] == car_id
        assert res_dict["retrieval_mode"] == "metadata"
        assert res_dict["relationship_type"] == "metadata_match"
        assert len(res_dict["matched_fields"]) >= 2
        # Provenance preserves both occurrences structurally
        occurrences = res_dict["provenance"]["source_occurrences"]
        assert len(occurrences) == 2
        assert occurrences[0]["original_path"] == "camera/IMG_001.jpg"
        assert occurrences[1]["original_path"] == "backup/IMG_001_copy.jpg"

        # 2. OCR text match
        ocr_page = service.search_metadata(query="SYDNEY")
        assert [r.asset_id for r in ocr_page.results] == [receipt_id]
        assert any(m.field == "ocr_text" for m in ocr_page.results[0].matched_fields)


def test_metadata_search_cursor_pagination(tmp_path: Path) -> None:
    db = tmp_path / "search.sqlite3"
    with VisualSearchService(db) as service:
        for idx in range(5):
            aid = canonical_id(f"asset-{idx}")
            service.index_metadata(
                MetadataDocumentInput(
                    asset_id=aid,
                    content_hash=aid,
                    mime_type="image/png",
                    size_bytes=1000 + idx,
                    original_path=f"folder/item_{idx}.png",
                    category="Photos",
                    tags=("archive",),
                )
            )

        page1 = service.search_metadata(filters={"tag": "archive"}, limit=2)
        assert len(page1.results) == 2
        assert page1.next_cursor is not None

        page2 = service.search_metadata(
            filters={"tag": "archive"}, limit=2, cursor=page1.next_cursor
        )
        assert len(page2.results) == 2
        assert page2.next_cursor is not None

        page3 = service.search_metadata(
            filters={"tag": "archive"}, limit=2, cursor=page2.next_cursor
        )
        assert len(page3.results) == 1
        assert page3.next_cursor is None

        seen_ids = [
            r.asset_id for r in (*page1.results, *page2.results, *page3.results)
        ]
        assert len(set(seen_ids)) == 5


def test_semantic_embedding_lifecycle_and_isolation(
    tmp_path: Path, semantic_profile: SemanticProfile
) -> None:
    db = tmp_path / "search.sqlite3"
    car_id = canonical_id("car")
    boat_id = canonical_id("boat")

    emb_car = SemanticEmbeddingInput(
        asset_id=car_id,
        content_hash=car_id,
        profile=semantic_profile,
        values=[0.9, 0.1, 0.0, 0.0],
        semantic_input_revision="semantic-input:summary-tags-ocr:v1",
        analysis_id="analysis:logical:car",
        analysis_result_id="analysis-result:car-terminal-1",
    )
    emb_boat = SemanticEmbeddingInput(
        asset_id=boat_id,
        content_hash=boat_id,
        profile=semantic_profile,
        values=[0.0, 0.9, 0.1, 0.0],
        semantic_input_revision="semantic-input:summary-tags-ocr:v1",
        analysis_id="analysis:logical:boat",
        analysis_result_id="analysis-result:boat-terminal-1",
    )

    with VisualSearchService(db) as service:
        assert service.index_semantic_embedding(emb_car) is True
        assert service.index_semantic_embedding(emb_car) is False
        assert service.index_semantic_embedding(emb_boat) is True

        results = service.search_semantic_vector(
            [1.0, 0.0, 0.0, 0.0], semantic_profile, limit=5
        )
        assert [r.asset_id for r in results] == [car_id, boat_id]
        car_dict = results[0].to_dict()
        assert car_dict["retrieval_mode"] == "semantic"
        assert car_dict["relationship_type"] == "semantically_related"
        assert car_dict["score_kind"] == "cosine_similarity"
        assert car_dict["model"] == {
            "family": "semantic",
            "model_id": "nomic-embed-text",
            "model_version": "1.5",
            "dimension": 4,
        }
        assert car_dict["analysis_id"] == "analysis:logical:car"
        assert car_dict["analysis_result_id"] == "analysis-result:car-terminal-1"
        assert car_dict["semantic_input_revision"] == "semantic-input:summary-tags-ocr:v1"
        assert car_dict["index_id"].startswith("semantic-index:")
        assert car_dict["index_version"]

        # Mark boat stale and verify it is excluded from semantic retrieval
        assert service.invalidate_semantic_asset(
            boat_id, semantic_profile, "semantic_input_superseded"
        )
        state = service.get_semantic_state(boat_id, semantic_profile)
        assert state.state == "stale"
        assert state.stale_reason == "semantic_input_superseded"

        active_results = service.search_semantic_vector(
            [1.0, 0.0, 0.0, 0.0], semantic_profile, limit=5
        )
        assert [r.asset_id for r in active_results] == [car_id]

        # Dimension mismatch rejected
        with pytest.raises(ContractError, match="dimension"):
            service.search_semantic_vector([1.0, 0.0], semantic_profile)


def test_hybrid_search_filter_then_rank_and_component_provenance(
    tmp_path: Path, profile: FeatureProfile, semantic_profile: SemanticProfile
) -> None:
    db = tmp_path / "search.sqlite3"
    seed_id = canonical_id("seed-car")
    cam_car_id = canonical_id("camera-red-car")
    other_car_id = canonical_id("downloaded-red-car")

    with VisualSearchService(db) as service:
        # Index metadata for both candidate assets
        service.index_metadata(
            MetadataDocumentInput(
                asset_id=cam_car_id,
                content_hash=cam_car_id,
                mime_type="image/jpeg",
                size_bytes=1024,
                original_path="camera/red_car_beach.jpg",
                source_kind="camera",
                category="Photos",
                tags=("car", "beach", "red"),
                summary="Red car near the beach",
                analysis_id="analysis:logical:cam-car",
                analysis_result_id="analysis-result:cam-car-1",
            )
        )
        service.index_metadata(
            MetadataDocumentInput(
                asset_id=other_car_id,
                content_hash=other_car_id,
                mime_type="image/jpeg",
                size_bytes=1024,
                original_path="downloads/red_car_beach.jpg",
                source_kind="downloads",
                category="Photos",
                tags=("car", "beach", "red"),
                summary="Downloaded red car near beach",
                analysis_id="analysis:logical:other-car",
                analysis_result_id="analysis-result:other-car-1",
            )
        )

        # Index visual features
        service.index_visual_feature(feature("seed-car", [1.0, 0.0, 0.0, 0.0], profile))
        service.index_visual_feature(feature("camera-red-car", [0.95, 0.05, 0.0, 0.0], profile))
        service.index_visual_feature(feature("downloaded-red-car", [0.99, 0.01, 0.0, 0.0], profile))

        # Index semantic embeddings
        service.index_semantic_embedding(
            SemanticEmbeddingInput(
                asset_id=cam_car_id,
                content_hash=cam_car_id,
                profile=semantic_profile,
                values=[0.9, 0.1, 0.0, 0.0],
                semantic_input_revision="semantic-input:v1",
                analysis_id="analysis:logical:cam-car",
                analysis_result_id="analysis-result:cam-car-1",
            )
        )
        service.index_semantic_embedding(
            SemanticEmbeddingInput(
                asset_id=other_car_id,
                content_hash=other_car_id,
                profile=semantic_profile,
                values=[0.95, 0.05, 0.0, 0.0],
                semantic_input_revision="semantic-input:v1",
                analysis_id="analysis:logical:other-car",
                analysis_result_id="analysis-result:other-car-1",
            )
        )

        # Execute hybrid query with deterministic filter source_kind="camera"
        results = service.search_hybrid(
            query="red car",
            filters={"source_kind": "camera"},
            semantic_vector=[1.0, 0.0, 0.0, 0.0],
            semantic_profile=semantic_profile,
            visual_seed_asset_id=seed_id,
            visual_profile=profile,
            limit=10,
        )

        # Only cam_car_id passes the deterministic pre-filter (filter_then_rank)
        assert [r.asset_id for r in results] == [cam_car_id]
        hybrid_dict = results[0].to_dict()
        assert hybrid_dict["retrieval_mode"] == "hybrid"
        assert hybrid_dict["score_kind"] == "weighted_normalized_score"
        assert hybrid_dict["ranking"]["ranker"] == "weighted_sum"
        assert (
            hybrid_dict["ranking"]["component_formula"]
            == "sum(component.normalized_score * component.weight)"
        )
        modes = {c["retrieval_mode"] for c in hybrid_dict["components"]}
        assert modes == {"metadata", "semantic", "visual_similarity"}
        for comp in hybrid_dict["components"]:
            assert 0.0 <= comp["normalized_score"] <= 1.0
            assert comp["index_id"]
            assert comp["index_version"]

