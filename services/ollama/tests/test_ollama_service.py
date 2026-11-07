from unittest.mock import MagicMock

import pytest

from ollama_service import (
    AssetContext,
    OllamaClient,
    OllamaHealth,
    OllamaService,
    SourceOccurrenceEvidence,
    create_default_tool_registry,
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


def test_ollama_service_ask_flow(sample_asset_context):
    client = MagicMock(spec=OllamaClient)
    client.health.return_value = OllamaHealth(reachable=False, status="unavailable")

    tools = create_default_tool_registry(
        search_metadata_fn=lambda **kw: [sample_asset_context],
        get_asset_fn=lambda asset_id: sample_asset_context,
    )

    service = OllamaService(client=client, tools=tools)
    answer = service.ask("What do these photos suggest happened?")

    assert len(answer.supporting_assets) == 1
    assert answer.supporting_assets[0].asset_id == sample_asset_context.asset_id
    assert answer.supporting_assets[0].analysis_result_id == sample_asset_context.analysis_result_id
    assert len(answer.limitations) > 0


def test_ollama_service_capabilities():
    client = MagicMock(spec=OllamaClient)
    client.capabilities.return_value = MagicMock(supports_embeddings=True)

    service = OllamaService(client=client)
    caps = service.capabilities("nomic-embed-text")
    assert caps.supports_embeddings
