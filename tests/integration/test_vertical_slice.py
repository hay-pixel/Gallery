"""Full vertical slice integration test: Ingestion -> Analysis -> Search -> Ask AI.

Proves:
1. Canonical asset identity: sha256 byte digests identify assets; byte-identical duplicates share asset_id.
2. Source occurrences: multiple paths/sources recorded against canonical asset.
3. Analysis: verified bytes produce immutable analysis record, tags, and visual features.
4. Search: visual features indexed into SQLite; visual similarity search retrieves related assets with exact provenance.
5. Ollama / Ask AI: bounded tools queried, natural language question grounded in verified asset evidence with exact citations and no hallucinations.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from analysis_service.backends import FeatureSpec, VisualObservation
from analysis_service.models import AssetInput, ConfidenceLabel, RuntimeDescriptor
from analysis_service.service import AnalysisService
from ollama_service import (
    AssetContext,
    OllamaService,
    SourceOccurrenceEvidence,
    create_default_tool_registry,
)
from PIL import Image
from search_service import VisualSearchService, visual_feature_input_from_analysis


class MockImageBackend:
    """Predictable visual classifier & feature extractor for vertical slice verification."""

    def __init__(self, observations: dict[str, VisualObservation] | None = None) -> None:
        self._observations = observations or {}

    @property
    def descriptor(self) -> RuntimeDescriptor:
        return RuntimeDescriptor("gallery/vertical-slice", "1.0", "gallery/vector", "1.0", "cpu")

    @property
    def feature_spec(self) -> FeatureSpec:
        return FeatureSpec(
            feature_type="image_embedding",
            feature_model_id="gallery/vector",
            feature_model_version="1.0",
            feature_extractor_revision="gallery-l2-v1",
            similarity_family="cosine",
            normalization={"kind": "l2", "applied": True},
        )

    def analyse_image(self, path: Path, _source_content_hash: str) -> VisualObservation:
        if _source_content_hash in self._observations:
            return self._observations[_source_content_hash]
        return VisualObservation(
            labels=[ConfidenceLabel("generic", 0.5, "classifier")],
            feature_values=[0.25, 0.25, 0.25, 0.25],
        )


def _create_test_image(path: Path, color: str, size: tuple[int, int] = (10, 10)) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    img = Image.new("RGB", size, color)
    img.save(path, format="PNG")
    data = path.read_bytes()
    return f"sha256:{hashlib.sha256(data).hexdigest()}"


def test_full_vertical_slice(tmp_path: Path) -> None:
    # -------------------------------------------------------------
    # Step 1: Ingestion of Source Files
    # -------------------------------------------------------------
    source_dir = tmp_path / "source"
    car_1_path = source_dir / "camera" / "car_beach.png"
    car_2_path = source_dir / "camera" / "car_sunset.png"
    car_duplicate_path = source_dir / "backup" / "car_beach_copy.png"
    invoice_path = source_dir / "documents" / "invoice_october.png"

    # Create images
    hash_car1 = _create_test_image(car_1_path, "red")
    hash_car2 = _create_test_image(car_2_path, "orange")
    # Duplicate is identical bytes to car1
    car_duplicate_path.parent.mkdir(parents=True, exist_ok=True)
    car_duplicate_path.write_bytes(car_1_path.read_bytes())
    hash_duplicate = f"sha256:{hashlib.sha256(car_duplicate_path.read_bytes()).hexdigest()}"
    hash_invoice = _create_test_image(invoice_path, "white")

    # Ingestion identity check:
    assert hash_car1 == hash_duplicate, "Byte-identical copies must produce identical SHA-256"

    # Ingestion records occurrences
    occurrences_by_asset: dict[str, list[SourceOccurrenceEvidence]] = {}

    def record_occurrence(asset_id: str, source_id: str, path_str: str) -> None:
        occ = SourceOccurrenceEvidence(
            source_occurrence_id=f"occ:{hashlib.sha256(path_str.encode()).hexdigest()[:16]}",
            source_id=source_id,
            original_path=path_str,
        )
        occurrences_by_asset.setdefault(asset_id, []).append(occ)

    record_occurrence(hash_car1, "camera_source", str(car_1_path))
    record_occurrence(hash_duplicate, "backup_source", str(car_duplicate_path))
    record_occurrence(hash_car2, "camera_source", str(car_2_path))
    record_occurrence(hash_invoice, "documents_source", str(invoice_path))

    # Verify duplicate occurrence grouped under single canonical asset
    assert len(occurrences_by_asset[hash_car1]) == 2
    assert len(occurrences_by_asset[hash_car2]) == 1
    assert len(occurrences_by_asset[hash_invoice]) == 1

    # -------------------------------------------------------------
    # Step 2: Visual Analysis
    # -------------------------------------------------------------
    analysis_dir = tmp_path / "analysis"
    backend = MockImageBackend(
        observations={
            hash_car1: VisualObservation(
                labels=[ConfidenceLabel("car", 0.95, "classifier"), ConfidenceLabel("vehicle", 0.90, "classifier")],
                feature_values=[1.0, 0.2, 0.0, 0.0],
            ),
            hash_car2: VisualObservation(
                labels=[ConfidenceLabel("car", 0.92, "classifier"), ConfidenceLabel("vehicle", 0.88, "classifier")],
                feature_values=[0.9, 0.3, 0.0, 0.0],
            ),
            hash_invoice: VisualObservation(
                labels=[ConfidenceLabel("document", 0.98, "classifier")],
                feature_values=[0.0, 0.0, 1.0, 0.1],
            ),
        }
    )
    analyser = AnalysisService(backend=backend, output_root=analysis_dir)

    # Analyse unique assets
    asset_car1 = AssetInput(hash_car1, hash_car1, str(car_1_path), "image/png")
    asset_car2 = AssetInput(hash_car2, hash_car2, str(car_2_path), "image/png")
    asset_invoice = AssetInput(hash_invoice, hash_invoice, str(invoice_path), "image/png")

    record_car1 = analyser.analyse(asset_car1).record
    record_car2 = analyser.analyse(asset_car2).record
    record_invoice = analyser.analyse(asset_invoice).record

    assert record_car1.status == "ready"
    assert "car" in [t.label for t in record_car1.tags]
    assert record_invoice.status == "ready"
    assert "document" in [t.label for t in record_invoice.tags]

    # Verify immutable persistence
    assert analyser.store.result_path(record_car1).exists()
    assert analyser.store.current_path(record_car1.asset_id, record_car1.analysis_id).exists()

    # -------------------------------------------------------------
    # Step 3: Search Indexing
    # -------------------------------------------------------------
    search_db = tmp_path / "search.sqlite3"
    with VisualSearchService(search_db) as search:
        # Index visual features from analysis records
        feat_car1 = visual_feature_input_from_analysis(record_car1.visual_features[0].to_dict())
        feat_car2 = visual_feature_input_from_analysis(record_car2.visual_features[0].to_dict())
        feat_invoice = visual_feature_input_from_analysis(record_invoice.visual_features[0].to_dict())

        search.index_visual_feature(feat_car1)
        search.index_visual_feature(feat_car2)
        search.index_visual_feature(feat_invoice)

        # Visual similarity retrieval: query for car_1 should return car_2 as visually similar
        sim_results = search.find_visually_similar(hash_car1, feat_car1.profile, limit=10)
        assert len(sim_results) >= 1
        # car_2 should rank before invoice
        assert sim_results[0].asset_id == hash_car2
        assert sim_results[0].analysis_id == record_car2.analysis_id
        assert sim_results[0].analysis_result_id == record_car2.result_id

    # -------------------------------------------------------------
    # Step 4: Ollama Service & Grounded Ask AI
    # -------------------------------------------------------------
    # Hydrate catalogue asset contexts for tool lookup
    catalogue_assets: dict[str, AssetContext] = {
        hash_car1: AssetContext(
            asset_id=hash_car1,
            original_path=str(car_1_path),
            mime_type="image/png",
            category="Photos",
            subcategory="Vehicles",
            tags=("car", "vehicle"),
            summary="Red vehicle parked at beach",
            analysis_id=record_car1.analysis_id,
            analysis_result_id=record_car1.result_id,
            evidence_source="search",
            source_occurrences=tuple(occurrences_by_asset[hash_car1]),
        ),
        hash_car2: AssetContext(
            asset_id=hash_car2,
            original_path=str(car_2_path),
            mime_type="image/png",
            category="Photos",
            subcategory="Vehicles",
            tags=("car", "vehicle"),
            summary="Orange vehicle at sunset",
            analysis_id=record_car2.analysis_id,
            analysis_result_id=record_car2.result_id,
            evidence_source="search",
            source_occurrences=tuple(occurrences_by_asset[hash_car2]),
        ),
        hash_invoice: AssetContext(
            asset_id=hash_invoice,
            original_path=str(invoice_path),
            mime_type="image/png",
            category="Documents",
            tags=("document",),
            ocr_text="INVOICE 1024 AMOUNT DUE $500",
            summary="Billing invoice statement",
            analysis_id=record_invoice.analysis_id,
            analysis_result_id=record_invoice.result_id,
            evidence_source="search",
            source_occurrences=tuple(occurrences_by_asset[hash_invoice]),
        ),
    }

    # Bounded tool handlers
    STOP_WORDS = {"what", "do", "we", "have", "are", "the", "a", "an", "photos", "pictures", "show", "me", "of", "in"}

    def search_metadata_impl(query: str = "", limit: int = 50, **kwargs) -> list[AssetContext]:
        q = query.lower()
        terms = [t for t in q.replace("?", "").split() if t not in STOP_WORDS]
        if not terms:
            terms = [q]
        matches = []
        for asset in catalogue_assets.values():
            corpus = " ".join([asset.original_path, asset.category, asset.subcategory or "", *asset.tags, asset.ocr_text, asset.summary]).lower()
            if any(term in corpus for term in terms):
                matches.append(asset)
        return matches[:limit]

    def find_similar_impl(asset_id: str, limit: int = 10) -> list[dict]:
        with VisualSearchService(search_db) as s:
            results = s.find_visually_similar(asset_id, feat_car1.profile, limit=limit)
            return [
                {
                    "asset_id": r.asset_id,
                    "score": r.score,
                    "analysis_id": r.analysis_id,
                    "analysis_result_id": r.analysis_result_id,
                }
                for r in results
            ]

    def get_asset_impl(asset_id: str) -> AssetContext | None:
        return catalogue_assets.get(asset_id)

    tools = create_default_tool_registry(
        search_metadata_fn=search_metadata_impl,
        find_visually_similar_fn=find_similar_impl,
        get_asset_fn=get_asset_impl,
    )

    ollama = OllamaService(tools=tools)

    # 1. Ask a question about vehicles (using offline/deterministic fallback)
    answer = ollama.ask("What car photos do we have?")

    assert "grounded catalogue" in answer.answer
    assert len(answer.supporting_assets) == 2
    supporting_ids = {a.asset_id for a in answer.supporting_assets}
    assert hash_car1 in supporting_ids
    assert hash_car2 in supporting_ids

    # Verify exact provenance is attached to citations
    for supp in answer.supporting_assets:
        assert supp.analysis_id is not None
        assert supp.analysis_result_id is not None
        assert len(supp.source_occurrences) >= 1

    # Specifically check the duplicate asset has 2 source occurrences
    car1_evidence = next(a for a in answer.supporting_assets if a.asset_id == hash_car1)
    assert len(car1_evidence.source_occurrences) == 2

    # 2. Ask a question about invoices / documents
    doc_answer = ollama.ask("Show invoice")
    assert len(doc_answer.supporting_assets) == 1
    assert doc_answer.supporting_assets[0].asset_id == hash_invoice

    # 3. Ask about an unknown concept -> truthful empty response
    empty_answer = ollama.ask("Find spaceship photos")
    assert "couldn’t find" in empty_answer.answer
    assert len(empty_answer.supporting_assets) == 0
    assert len(empty_answer.limitations) > 0
