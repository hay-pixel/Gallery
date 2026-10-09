from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image

from analysis_service.backends import FeatureSpec, VisualObservation
from analysis_service.models import AssetInput, ConfidenceLabel, RuntimeDescriptor
from analysis_service.service import AnalysisService
from search_service import VisualSearchService, visual_feature_input_from_analysis


class DeterministicBackend:
    @property
    def descriptor(self) -> RuntimeDescriptor:
        return RuntimeDescriptor("test/local", "1", "test/vector", "1", "cpu")

    @property
    def feature_spec(self) -> FeatureSpec:
        return FeatureSpec(
            feature_type="image_embedding",
            feature_model_id="test/vector",
            feature_model_version="1",
            feature_extractor_revision="test-inline-l2-v1",
            similarity_family="cosine",
            normalization={"kind": "l2", "applied": True},
        )

    def analyse_image(self, _path: Path, _source_content_hash: str) -> VisualObservation:
        return VisualObservation(
            labels=[ConfidenceLabel("fixture", 1.0, "classifier")],
            feature_values=[1.0, 0.0, 0.0, 0.0],
        )


def _asset(path: Path, colour: str) -> AssetInput:
    Image.new("RGB", (2, 2), colour).save(path, format="PNG")
    digest = f"sha256:{hashlib.sha256(path.read_bytes()).hexdigest()}"
    return AssetInput(digest, digest, str(path), "image/png")


def test_real_analysis_serialized_feature_indexes_and_retrieves_exact_result_provenance(tmp_path):
    asset_a = _asset(tmp_path / "a.png", "red")
    asset_b = _asset(tmp_path / "b.png", "blue")
    analysis = AnalysisService(backend=DeterministicBackend(), output_root=tmp_path / "analysis")
    first = analysis.analyse(asset_a).record
    second = analysis.analyse(asset_b).record
    search_a = visual_feature_input_from_analysis(first.visual_features[0].to_dict())
    search_b = visual_feature_input_from_analysis(second.visual_features[0].to_dict())
    with VisualSearchService(tmp_path / "search.sqlite3") as search:
        search.index_visual_feature(search_a)
        search.index_visual_feature(search_b)
        results = search.find_visually_similar(asset_a.asset_id, search_a.profile)
        assert [result.asset_id for result in results] == [asset_b.asset_id]
        assert results[0].analysis_id == second.analysis_id
        assert results[0].analysis_result_id == second.result_id
        rerun = analysis.analyse(asset_b, force=True).record
        rerun_input = visual_feature_input_from_analysis(rerun.visual_features[0].to_dict())
        search.index_visual_feature(rerun_input)
        assert search.find_visually_similar(asset_a.asset_id, search_a.profile)[0].analysis_result_id == rerun.result_id


def test_local_catalogue_bytes_feed_existing_analysis_search_contracts(tmp_path):
    from catalogue_service.store import Catalogue

    source = tmp_path / "collection"
    source.mkdir()
    Image.new("RGB", (2, 2), "red").save(source / "a.png")
    Image.new("RGB", (2, 2), "blue").save(source / "b.png")
    catalogue = Catalogue(tmp_path / "catalogue")
    try:
        catalogue.import_collection(source, owner="alice", source_id="local-photos")
        rows = catalogue.list_assets(owner="alice")["results"]
    finally:
        catalogue.close()
    # Analysis must read owned canonical bytes, even if originals disappear.
    for path in source.iterdir():
        path.unlink()
    analysis = AnalysisService(backend=DeterministicBackend(), output_root=tmp_path / "analysis")
    inputs = []
    for row in rows:
        asset = AssetInput.from_asset_record(row["asset"])
        record = analysis.analyse(asset).record
        assert record.input_content_hash == asset.asset_id
        inputs.append(visual_feature_input_from_analysis(record.visual_features[0].to_dict()))
    with VisualSearchService(tmp_path / "search.sqlite3") as search:
        for feature in inputs:
            search.index_visual_feature(feature)
        matches = search.find_visually_similar(inputs[0].asset_id, inputs[0].profile)
        assert [result.asset_id for result in matches] == [inputs[1].asset_id]
