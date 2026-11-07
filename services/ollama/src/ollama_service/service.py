"""High-level service boundary for Ollama inference, query routing, and grounded answers.

Conforms strictly to docs/contracts/OLLAMA.md:
Boundary operations:
- health()
- models()
- capabilities(model_id)
- embed(input, profile)
- interpret_query(query, context)
- plan_retrieval(query, available_tools)
- tool_call(tool_name, arguments)
- answer_with_grounding(question, retrieved_assets, optional_web_context)
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from .client import OllamaClient
from .grounding import GroundingEngine
from .models import (
    AssetContext,
    GroundedAnswer,
    ModelCapabilities,
    ModelInfo,
    OllamaHealth,
    QueryPlan,
    WebContext,
)
from .router import QueryRouter
from .tools import ToolRegistry


class OllamaService:
    """Universal Ollama service adapter for reasoning and grounded retrieval."""

    def __init__(
        self,
        *,
        client: OllamaClient | None = None,
        host: str = "http://127.0.0.1:11434",
        model_name: str = "llama3.2:3b",
        embedding_model: str = "nomic-embed-text",
        tools: ToolRegistry | None = None,
    ) -> None:
        self._client = client or OllamaClient(host=host)
        self._model_name = model_name
        self._embedding_model = embedding_model
        self._tools = tools or ToolRegistry()
        self._router = QueryRouter()
        self._grounding = GroundingEngine(client=self._client, model_name=self._model_name)

    @property
    def client(self) -> OllamaClient:
        return self._client

    @property
    def tools(self) -> ToolRegistry:
        return self._tools

    def health(self) -> OllamaHealth:
        """Check status and reachability of the private Ollama runtime."""
        return self._client.health()

    def models(self) -> list[ModelInfo]:
        """List models currently available in local Ollama storage."""
        return self._client.list_models()

    def capabilities(self, model_id: str) -> ModelCapabilities:
        """Inspect capabilities of a specific model ID."""
        return self._client.capabilities(model_id)

    def embed(self, input_text: str | list[str], *, model: str | None = None) -> list[list[float]]:
        """Compute semantic vector embeddings for natural language strings."""
        target_model = model or self._embedding_model
        return self._client.embed(target_model, input_text)

    def interpret_query(self, query: str, *, context: dict[str, Any] | None = None) -> QueryPlan:
        """Map user request to an auditable retrieval plan."""
        return self._router.plan(query, context=context)

    def tool_call(self, tool_name: str, arguments: dict[str, Any]) -> Any:
        """Execute a registered server tool with bounds enforcement and audit logging."""
        return self._tools.execute(tool_name, arguments)

    def answer_with_grounding(
        self,
        question: str,
        retrieved_assets: Sequence[AssetContext],
        *,
        optional_web_context: Sequence[WebContext] | None = None,
    ) -> GroundedAnswer:
        """Synthesize a grounded response citing only verified candidate assets."""
        return self._grounding.synthesize(
            question,
            retrieved_assets,
            optional_web_context=optional_web_context,
        )

    def ask(self, question: str, *, context: dict[str, Any] | None = None) -> GroundedAnswer:
        """Full end-to-end question answering loop: route -> retrieve -> ground."""
        plan = self.interpret_query(question, context=context)

        retrieved_assets: list[AssetContext] = []
        for op in plan.operations:
            try:
                result = self.tool_call(op.tool, dict(op.arguments))
                if isinstance(result, list):
                    for item in result:
                        if isinstance(item, AssetContext):
                            retrieved_assets.append(item)
                elif isinstance(result, AssetContext):
                    retrieved_assets.append(result)
            except (RuntimeError, ValueError, OSError) as exc:
                # Continue with other operations if one tool fails gracefully
                import logging
                logging.getLogger("gallery.ollama").warning("Tool %s failed: %s", op.tool, exc)

        return self.answer_with_grounding(question, retrieved_assets)
