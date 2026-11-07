import json
from unittest.mock import MagicMock

import pytest

from ollama_service import (
    AssetContext,
    GroundingEngine,
    OllamaClient,
    OllamaHealth,
    SourceOccurrenceEvidence,
)


@pytest.fixture
def sample_asset_context() -> AssetContext:
    return AssetContext(
        asset_id="sha256:1111111111111111111111111111111111111111111111111111111111111111",
        original_path="camera/IMG_001.jpg",
        tags=("red", "car"),
        analysis_id="analysis:1",
        analysis_result_id="result:1",
        source_occurrences=(
            SourceOccurrenceEvidence("occ:1", "src:1", "camera/IMG_001.jpg"),
        ),
    )


def test_grounding_empty_context():
    engine = GroundingEngine(client=None)
    answer = engine.synthesize("What cars are in the library?", [])
    assert "couldn’t find" in answer.answer
    assert len(answer.supporting_assets) == 0
    assert len(answer.limitations) > 0


def test_grounding_offline_fallback(sample_asset_context):
    client = MagicMock(spec=OllamaClient)
    client.health.return_value = OllamaHealth(reachable=False, status="unavailable")

    engine = GroundingEngine(client=client)
    answer = engine.synthesize("Show me cars", [sample_asset_context])

    assert "Found 1 grounded catalogue record" in answer.answer
    assert len(answer.supporting_assets) == 1
    assert answer.supporting_assets[0].asset_id == sample_asset_context.asset_id
    assert answer.supporting_assets[0].analysis_result_id == sample_asset_context.analysis_result_id
    assert "offline" in answer.limitations[0]


def test_grounding_filters_hallucinated_asset_ids(sample_asset_context):
    client = MagicMock(spec=OllamaClient)
    client.health.return_value = OllamaHealth(reachable=True, status="available")

    # Ollama tries to cite a fake hash along with the real one
    fake_id = "sha256:9999999999999999999999999999999999999999999999999999999999999999"
    client.chat.return_value = {
        "message": {
            "content": json.dumps({
                "answer": "There is a red car parked near the beach.",
                "cited_asset_ids": [sample_asset_context.asset_id, fake_id],
                "limitations": [],
            })
        }
    }

    engine = GroundingEngine(client=client)
    answer = engine.synthesize("What car is this?", [sample_asset_context])

    assert answer.answer == "There is a red car parked near the beach."
    # The hallucinated ID must be filtered out!
    assert len(answer.supporting_assets) == 1
    assert answer.supporting_assets[0].asset_id == sample_asset_context.asset_id
    assert answer.supporting_assets[0].analysis_id == sample_asset_context.analysis_id
    assert answer.supporting_assets[0].analysis_result_id == sample_asset_context.analysis_result_id
