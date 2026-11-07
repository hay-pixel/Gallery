import pytest

from ollama_service import (
    AssetContext,
    OllamaContractError,
    SourceOccurrenceEvidence,
    ToolRegistry,
    create_default_tool_registry,
)


@pytest.fixture
def sample_asset_context() -> AssetContext:
    return AssetContext(
        asset_id="sha256:1111111111111111111111111111111111111111111111111111111111111111",
        original_path="camera/IMG_001.jpg",
        tags=("red", "car"),
        source_occurrences=(
            SourceOccurrenceEvidence("occ:1", "src:1", "camera/IMG_001.jpg"),
        ),
    )


def test_tool_registry_bounds_limit():
    registry = ToolRegistry()
    registry.register(
        name="test_tool",
        description="test",
        parameters={"type": "object"},
        handler=lambda limit=10: [i for i in range(limit)],
        max_limit=25,
    )

    # Request over max_limit gets bounded
    res = registry.execute("test_tool", {"limit": 100})
    assert len(res) == 25
    assert registry.audit_logs[-1].result_count == 25
    assert registry.audit_logs[-1].error_class is None


def test_tool_registry_validates_asset_id():
    registry = ToolRegistry()
    registry.register(
        name="lookup",
        description="test",
        parameters={"type": "object"},
        handler=lambda asset_id: asset_id,
    )

    with pytest.raises(OllamaContractError):
        registry.execute("lookup", {"asset_id": "invalid-non-hash"})


def test_tool_registry_audit_log_records_error():
    registry = ToolRegistry()

    def bad_tool():
        raise RuntimeError("database unreachable")

    registry.register(
        name="broken",
        description="test",
        parameters={"type": "object"},
        handler=bad_tool,
    )

    with pytest.raises(RuntimeError):
        registry.execute("broken", {})

    assert registry.audit_logs[-1].error_class == "RuntimeError"


def test_default_tool_registry_schemas(sample_asset_context):
    registry = create_default_tool_registry(
        search_metadata_fn=lambda **kw: [sample_asset_context],
        get_asset_fn=lambda asset_id: sample_asset_context,
    )

    defs = registry.get_tool_definitions_for_ollama()
    names = [d["function"]["name"] for d in defs]
    assert "search_metadata" in names
    assert "get_asset" in names

    out = registry.execute("search_metadata", {"query": "test"})
    assert len(out) == 1
    assert out[0].asset_id == sample_asset_context.asset_id
