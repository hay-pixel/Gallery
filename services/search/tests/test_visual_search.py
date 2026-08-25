from __future__ import annotations

import sqlite3
from pathlib import Path

import numpy as np
import pytest
from conftest import canonical_id, feature

from search_service import (
    AssetNotIndexedError,
    ContractError,
    FeatureProfile,
    IndexUnavailableError,
    VisualFeatureInput,
    VisualSearchService,
)


def test_indexes_canonical_assets_and_returns_expected_neighbours(tmp_path, profile):
    database = tmp_path / "visual.sqlite3"
    seed = feature("seed", [1.0, 0.0, 0.0, 0.0], profile)
    nearest = feature("nearest", [0.98, 0.02, 0.0, 0.0], profile)
    distant = feature("distant", [0.0, 1.0, 0.0, 0.0], profile)

    with VisualSearchService(database) as service:
        assert service.index_visual_feature(seed)
        assert service.index_visual_feature(nearest)
        assert service.index_visual_feature(distant)
        results = service.find_visually_similar(seed.asset_id, profile, limit=10)

    assert [item.asset_id for item in results] == [nearest.asset_id, distant.asset_id]
    assert all(item.asset_id.startswith("sha256:") for item in results)
    assert all(item.content_hash == item.asset_id for item in results)
    assert all(item.relationship_type == "visually_similar" for item in results)
    assert results[0].score > results[1].score
    assert results[0].to_dict()["retrieval_mode"] == "visual_similarity"


def test_same_asset_is_excluded_and_similarity_never_claims_exact_duplicate(tmp_path, profile):
    database = tmp_path / "visual.sqlite3"
    seed = feature("seed", [1.0, 0.0, 0.0, 0.0], profile)
    identical_vector_different_bytes = feature("copy", [1.0, 0.0, 0.0, 0.0], profile)

    with VisualSearchService(database, near_duplicate_threshold=0.99) as service:
        service.index_visual_feature(seed)
        service.index_visual_feature(identical_vector_different_bytes)
        results = service.find_visually_similar(seed.asset_id, profile)

    assert [item.asset_id for item in results] == [identical_vector_different_bytes.asset_id]
    assert results[0].relationship_type == "near_duplicate_candidate"
    assert results[0].relationship_type != "exact_duplicate"


def test_model_versions_are_isolated_and_dimension_mismatch_is_rejected(tmp_path, profile):
    database = tmp_path / "visual.sqlite3"
    other_version = FeatureProfile(
        feature_type=profile.feature_type,
        feature_model_id=profile.feature_model_id,
        feature_model_version="2.0.0",
        feature_extractor_revision=profile.feature_extractor_revision,
        dimensions=profile.dimensions,
        similarity_family=profile.similarity_family,
        normalization=profile.normalization,
    )
    seed = feature("seed", [1.0, 0.0, 0.0, 0.0], profile)
    other = feature("other", [1.0, 0.0, 0.0, 0.0], other_version)

    with VisualSearchService(database) as service:
        service.index_visual_feature(seed)
        service.index_visual_feature(other)
        assert service.get_index_status(profile).active_vector_count == 1
        assert service.get_index_status(other_version).active_vector_count == 1
        with pytest.raises(AssetNotIndexedError, match="no visual feature"):
            service.find_visually_similar(seed.asset_id, other_version)
        with pytest.raises(ContractError, match="vector length"):
            service.index_visual_feature(
                VisualFeatureInput(
                    asset_id=canonical_id("bad"),
                    input_content_hash=canonical_id("bad"),
                    profile=profile,
                    values=[1.0, 0.0],
                    feature_id="visual-feature:bad",
                )
            )


def test_upsert_is_idempotent_then_can_replace_derived_state(tmp_path, profile):
    database = tmp_path / "visual.sqlite3"
    original = feature("seed", [1.0, 0.0, 0.0, 0.0], profile)
    replacement = feature("seed", [0.0, 1.0, 0.0, 0.0], profile, revision="analysis-fixture-v2")

    with VisualSearchService(database) as service:
        assert service.index_visual_feature(original)
        assert not service.index_visual_feature(original)
        first_version = service.get_index_status(profile).index_version
        assert service.index_visual_feature(replacement)
        assert service.get_index_status(profile).index_version != first_version


def test_removal_and_filtering_are_explicit(tmp_path, profile):
    database = tmp_path / "visual.sqlite3"
    seed = feature("seed", [1.0, 0.0, 0.0, 0.0], profile)
    allowed = feature("allowed", [0.9, 0.1, 0.0, 0.0], profile)
    blocked = feature("blocked", [0.8, 0.2, 0.0, 0.0], profile)

    with VisualSearchService(database) as service:
        for item in (seed, allowed, blocked):
            service.index_visual_feature(item)
        results = service.find_visually_similar(
            seed.asset_id,
            profile,
            filters={"include_asset_ids": [allowed.asset_id, blocked.asset_id], "exclude_asset_ids": blocked.asset_id},
        )
        assert [item.asset_id for item in results] == [allowed.asset_id]
        assert service.remove_asset(allowed.asset_id, profile) == 1
        assert service.remove_asset(allowed.asset_id, profile) == 0
        assert service.get_search_state(allowed.asset_id, profile).state == "missing"


def test_index_survives_process_restart_and_returns_ranked_assets(tmp_path, profile):
    database = tmp_path / "visual.sqlite3"
    seed = feature("seed", [1.0, 0.0, 0.0, 0.0], profile)
    neighbour = feature("neighbour", [0.95, 0.05, 0.0, 0.0], profile)

    with VisualSearchService(database) as service:
        service.index_visual_feature(seed)
        service.index_visual_feature(neighbour)

    with VisualSearchService(database) as restarted:
        status = restarted.get_index_status(profile)
        results = restarted.find_visually_similar(seed.asset_id, profile)

    assert status.state == "ready"
    assert status.active_vector_count == 2
    assert [item.asset_id for item in results] == [neighbour.asset_id]


def test_stale_vectors_are_unavailable_until_rebuilt_from_authorised_features(tmp_path, profile):
    database = tmp_path / "visual.sqlite3"
    seed = feature("seed", [1.0, 0.0, 0.0, 0.0], profile)
    neighbour = feature("neighbour", [0.9, 0.1, 0.0, 0.0], profile)

    with VisualSearchService(database) as service:
        service.index_visual_feature(seed)
        service.index_visual_feature(neighbour)
        assert service.invalidate_asset(neighbour.asset_id, profile, "analysis_revision_superseded")
        state = service.get_search_state(neighbour.asset_id, profile)
        assert state.state == "stale"
        assert state.stale_reason == "analysis_revision_superseded"
        degraded_status = service.get_index_status(profile)
        assert degraded_status.state == "degraded"
        health = service.health()
        assert health["service_status"] == "ready"
        assert health["index_status"] == "degraded"
        assert health["profiles"][0]["state"] == "degraded"
        with pytest.raises(AssetNotIndexedError, match="stale"):
            service.find_visually_similar(neighbour.asset_id, profile)
        status = service.rebuild_from_features(profile, [seed, neighbour])
        assert status.state == "ready"
        assert status.active_vector_count == 2
        assert status.stale_vector_count == 0


def test_corrupt_derived_vector_isolated_during_rebuild(tmp_path, profile):
    database = tmp_path / "visual.sqlite3"
    seed = feature("seed", [1.0, 0.0, 0.0, 0.0], profile)

    with VisualSearchService(database) as service:
        service.index_visual_feature(seed)

    with sqlite3.connect(database) as connection:
        connection.execute(
            "UPDATE vectors SET vector_blob = ? WHERE partition_key = ? AND asset_id = ?",
            (b"not-a-float-vector", profile.partition_key, seed.asset_id),
        )
        connection.commit()

    with VisualSearchService(database) as service:
        status = service.rebuild_index(profile)
        assert status.state == "degraded"
        assert status.active_vector_count == 0
        assert status.stale_vector_count == 1
        assert service.health()["index_status"] == "degraded"
        with pytest.raises(AssetNotIndexedError, match="stale visual feature"):
            service.find_visually_similar(seed.asset_id, profile)


def test_empty_rebuild_clears_profile_without_raising_or_leaving_stale_state(tmp_path, profile):
    database = tmp_path / "visual.sqlite3"
    seed = feature("seed", [1.0, 0.0, 0.0, 0.0], profile)
    stale = feature("stale", [0.9, 0.1, 0.0, 0.0], profile)

    with VisualSearchService(database) as service:
        service.index_visual_feature(seed)
        service.index_visual_feature(stale)
        service.invalidate_asset(stale.asset_id, profile, "superseded")
        status = service.rebuild_from_features(profile, [])
        assert status.state == "empty"
        assert status.active_vector_count == 0
        assert status.stale_vector_count == 0
        assert service.get_search_state(seed.asset_id, profile).state == "missing"
        assert service.get_search_state(stale.asset_id, profile).state == "missing"
        health = service.health()
        assert health["service_status"] == "ready"
        assert health["index_status"] == "ready"
        assert health["profiles"][0]["state"] == "empty"


def test_rejects_malformed_feature_without_writing_any_vector(tmp_path, profile):
    database = tmp_path / "visual.sqlite3"
    with VisualSearchService(database) as service:
        with pytest.raises(ContractError, match="same canonical bytes"):
            service.index_visual_feature(
                VisualFeatureInput(
                    asset_id=canonical_id("asset"),
                    input_content_hash=canonical_id("different"),
                    profile=profile,
                    values=[1.0, 0.0, 0.0, 0.0],
                    feature_id="visual-feature:malformed",
                )
            )
        with pytest.raises(IndexUnavailableError, match="no visual index"):
            service.get_index_status(profile)


def test_public_result_contract_does_not_expose_internal_vector_or_database_ids(tmp_path, profile):
    database = tmp_path / "visual.sqlite3"
    seed = feature("seed", [1.0, 0.0, 0.0, 0.0], profile)
    neighbour = feature("neighbour", [0.9, 0.1, 0.0, 0.0], profile)
    with VisualSearchService(database) as service:
        service.index_visual_feature(seed)
        service.index_visual_feature(neighbour)
        payload = service.find_visually_similar(seed.asset_id, profile)[0].to_dict()

    assert payload["asset_id"] == neighbour.asset_id
    assert "vector_blob" not in payload
    assert "rowid" not in payload
    assert "partition_key" not in payload
    assert payload["analysis_id"] == "analysis:fixture-logical-v1"
    assert payload["analysis_result_id"] == "analysis-result:fixture-terminal-v1"


def test_extractor_revision_and_normalization_create_isolated_profiles(profile):
    with pytest.raises(ContractError, match="feature_extractor_revision"):
        FeatureProfile(
            feature_type=profile.feature_type,
            feature_model_id=profile.feature_model_id,
            feature_model_version=profile.feature_model_version,
            feature_extractor_revision="",
            dimensions=profile.dimensions,
            similarity_family="cosine",
            normalization=profile.normalization,
        )
    changed_extractor = FeatureProfile(
        feature_type=profile.feature_type,
        feature_model_id=profile.feature_model_id,
        feature_model_version=profile.feature_model_version,
        feature_extractor_revision="fixture-extractor-v2",
        dimensions=profile.dimensions,
        similarity_family="cosine",
        normalization=profile.normalization,
    )
    changed_normalization = FeatureProfile(
        feature_type=profile.feature_type,
        feature_model_id=profile.feature_model_id,
        feature_model_version=profile.feature_model_version,
        feature_extractor_revision=profile.feature_extractor_revision,
        dimensions=profile.dimensions,
        similarity_family="cosine",
        normalization={"kind": "l2", "applied": True},
    )
    assert changed_extractor.partition_key != profile.partition_key
    assert changed_normalization.partition_key != profile.partition_key


def test_production_source_has_no_build_agent_runtime_dependency():
    source_root = Path(__file__).parents[1] / "src"
    prohibited = [
        "MAN" + "US_API",
        "man" + "us.ai",
        "from " + "man" + "us",
        "import " + "man" + "us",
        "man" + "us-specific",
    ]
    production_text = "\n".join(path.read_text().lower() for path in source_root.rglob("*.py"))
    assert all(term.lower() not in production_text for term in prohibited)


def test_python_metadata_declares_3_12_baseline():
    metadata = (Path(__file__).parents[1] / "pyproject.toml").read_text()
    assert 'requires-python = ">=3.12"' in metadata
    assert 'target-version = "py312"' in metadata
    assert 'python_version = "3.12"' in metadata


def test_cosine_scores_are_clamped_without_hiding_non_finite_inputs(tmp_path, profile):
    database = tmp_path / "visual.sqlite3"
    seed = feature("seed", [1.0, 0.0, 0.0, 0.0], profile)
    neighbour = feature("neighbour", [1.0, 0.0, 0.0, 0.0], profile)
    with VisualSearchService(database) as service:
        service.index_visual_feature(seed)
        service.index_visual_feature(neighbour)
        snapshot = service._snapshot(profile)
        object.__setattr__(snapshot, "normalised_matrix", np.asarray([[1.0, 0.0, 0.0, 0.0], [1.0000001, 0.0, 0.0, 0.0]]))
        result = service.find_visually_similar(seed.asset_id, profile, include_seed=True)[0]
        assert result.score == 1.0
        with pytest.raises(ContractError, match="finite"):
            service.find_similar_vector([float("nan"), 0.0, 0.0, 0.0], profile)


def test_shared_database_revision_invalidates_cached_snapshots(tmp_path, profile):
    database = tmp_path / "shared.sqlite3"
    seed = feature("seed", [1.0, 0.0, 0.0, 0.0], profile)
    first = feature("first", [0.9, 0.1, 0.0, 0.0], profile)
    second = feature("second", [0.8, 0.2, 0.0, 0.0], profile)
    with VisualSearchService(database) as writer, VisualSearchService(database) as reader:
        writer.index_visual_feature(seed)
        writer.index_visual_feature(first)
        assert [item.asset_id for item in reader.find_visually_similar(seed.asset_id, profile)] == [first.asset_id]
        writer.index_visual_feature(second)
        assert {item.asset_id for item in reader.find_visually_similar(seed.asset_id, profile)} == {first.asset_id, second.asset_id}
        assert writer.remove_asset(first.asset_id, profile) == 1
        assert [item.asset_id for item in reader.find_visually_similar(seed.asset_id, profile)] == [second.asset_id]
        assert writer.invalidate_asset(second.asset_id, profile, "authorised_reanalysis_required")
        with pytest.raises(AssetNotIndexedError, match="stale"):
            reader.find_visually_similar(second.asset_id, profile)


def test_directory_creation_failure_is_translated_to_search_unavailable(monkeypatch, tmp_path):
    def fail_mkdir(self, *args, **kwargs):
        raise PermissionError("read-only test path")

    monkeypatch.setattr(Path, "mkdir", fail_mkdir)
    with pytest.raises(IndexUnavailableError, match="visual index database is unavailable"):
        VisualSearchService(tmp_path / "blocked" / "visual.sqlite3")
