import pytest

from ollama_service import OllamaContractError, QueryRouter


def test_router_exact_identity():
    router = QueryRouter()
    plan = router.plan("find sha256:1111111111111111111111111111111111111111111111111111111111111111")
    assert plan.intent == "exact_identity"
    assert not plan.requires_ollama
    assert plan.operations[0].tool == "get_asset"
    assert plan.operations[0].arguments["asset_id"] == "sha256:1111111111111111111111111111111111111111111111111111111111111111"


def test_router_visual_similarity():
    router = QueryRouter()
    context = {"seed_asset_id": "sha256:2222222222222222222222222222222222222222222222222222222222222222"}
    plan = router.plan("find items visually similar to this", context=context)
    assert plan.intent == "visual_similarity"
    assert not plan.requires_ollama
    assert plan.operations[0].tool == "find_visually_similar"
    assert plan.operations[0].arguments["asset_id"] == context["seed_asset_id"]


def test_router_metadata_filter():
    router = QueryRouter()
    plan = router.plan("mime:image/png tagged receipts")
    assert plan.intent == "metadata_filter"
    assert not plan.requires_ollama
    assert plan.operations[0].tool == "search_metadata"
    filters = plan.operations[0].arguments["filters"]
    assert filters["mime_type"] == "image/png"
    assert "receipts" in filters["tag"]


def test_router_archive_reasoning():
    router = QueryRouter()
    plan = router.plan("What do these photos suggest happened during the trip?")
    assert plan.intent == "archive_reasoning"
    assert plan.requires_ollama
    assert plan.grounding_required
    assert plan.combine.strategy == "single_operation"
    assert plan.operations[0].tool == "search_metadata"


def test_router_empty_query():
    router = QueryRouter()
    with pytest.raises(OllamaContractError):
        router.plan("   ")
