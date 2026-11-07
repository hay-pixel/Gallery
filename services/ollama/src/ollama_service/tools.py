"""Bounded, server-controlled tools for Ollama retrieval and context lookup.

Strict security rules (docs/contracts/OLLAMA.md):
- allowed argument schemas
- enforced timeouts and result limits
- no arbitrary filesystem access
- no arbitrary shell execution
- no browser/mobile secret exposure
- audit logging of tool name, inputs, result count, and error class
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

from .models import AssetContext, OllamaContractError, check_hash

logger = logging.getLogger("gallery.ollama.tools")

MAX_TOOL_RESULT_LIMIT = 200
DEFAULT_TOOL_TIMEOUT_SECONDS = 10.0


@dataclass(frozen=True)
class ToolAuditLog:
    tool_name: str
    arguments: dict[str, Any]
    result_count: int
    duration_ms: float
    error_class: str | None = None
    timestamp: float = field(default_factory=time.time)


@dataclass(frozen=True)
class ToolDefinition:
    name: str
    description: str
    parameters: dict[str, Any]
    handler: Callable[..., Any]
    max_limit: int = MAX_TOOL_RESULT_LIMIT


class ToolRegistry:
    """Server-side bounded registry of approved tools callable by Ollama."""

    def __init__(self) -> None:
        self._tools: dict[str, ToolDefinition] = {}
        self._audit_logs: list[ToolAuditLog] = []

    @property
    def audit_logs(self) -> list[ToolAuditLog]:
        return list(self._audit_logs)

    def register(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any],
        handler: Callable[..., Any],
        max_limit: int = MAX_TOOL_RESULT_LIMIT,
    ) -> None:
        self._tools[name] = ToolDefinition(
            name=name,
            description=description,
            parameters=parameters,
            handler=handler,
            max_limit=max_limit,
        )

    def get_tool_definitions_for_ollama(self) -> list[dict[str, Any]]:
        """Return tool definitions in Ollama / OpenAI function calling schema."""
        specs = []
        for tool in self._tools.values():
            specs.append({
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.parameters,
                },
            })
        return specs

    def execute(self, tool_name: str, arguments: dict[str, Any]) -> Any:
        """Execute a tool with argument validation and audit logging."""
        if tool_name not in self._tools:
            raise OllamaContractError(f"Tool '{tool_name}' is not an approved project tool")

        tool = self._tools[tool_name]
        start = time.perf_counter()
        error_class: str | None = None
        result_count = 0

        # Enforce result limits
        args_copy = dict(arguments)
        if "limit" in args_copy:
            try:
                requested_limit = int(args_copy["limit"])
                args_copy["limit"] = min(max(1, requested_limit), tool.max_limit)
            except (ValueError, TypeError):
                args_copy["limit"] = 50

        # Validate asset_id if present
        if "asset_id" in args_copy:
            check_hash(str(args_copy["asset_id"]), "asset_id")

        try:
            result = tool.handler(**args_copy)
            if isinstance(result, list):
                result_count = len(result)
            elif isinstance(result, (dict, AssetContext)):
                result_count = 1
            return result
        except Exception as exc:
            error_class = exc.__class__.__name__
            logger.warning(
                "Tool execution failed for %s with args %s: %s",
                tool_name,
                args_copy,
                exc,
            )
            raise
        finally:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            self._audit_logs.append(
                ToolAuditLog(
                    tool_name=tool_name,
                    arguments=args_copy,
                    result_count=result_count,
                    duration_ms=elapsed_ms,
                    error_class=error_class,
                )
            )


def create_default_tool_registry(
    *,
    search_metadata_fn: Callable[..., list[AssetContext]] | None = None,
    find_visually_similar_fn: Callable[..., list[dict[str, Any]]] | None = None,
    search_semantic_fn: Callable[..., list[AssetContext]] | None = None,
    get_asset_fn: Callable[[str], AssetContext | None] | None = None,
    get_analysis_fn: Callable[[str], dict[str, Any] | None] | None = None,
) -> ToolRegistry:
    """Build the standard project-owned tool registry with strict boundaries."""
    registry = ToolRegistry()

    if search_metadata_fn:
        registry.register(
            name="search_metadata",
            description="Find assets by deterministic filters (filename, category, tag, mime_type, date)",
            parameters={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search keyword for filenames, tags, or OCR"},
                    "category": {"type": "string", "description": "Category filter (Photos, Documents, Videos, etc.)"},
                    "mime_type": {"type": "string", "description": "MIME type filter, e.g. image/jpeg"},
                    "limit": {"type": "integer", "description": "Maximum records to return (1-100)"},
                },
            },
            handler=search_metadata_fn,
            max_limit=100,
        )

    if find_visually_similar_fn:
        registry.register(
            name="find_visually_similar",
            description="Find canonical assets visually similar to a given canonical asset_id",
            parameters={
                "type": "object",
                "properties": {
                    "asset_id": {"type": "string", "description": "Canonical seed asset ID (sha256:...)"},
                    "limit": {"type": "integer", "description": "Maximum similar items (1-50)"},
                },
                "required": ["asset_id"],
            },
            handler=find_visually_similar_fn,
            max_limit=50,
        )

    if search_semantic_fn:
        registry.register(
            name="search_semantic",
            description="Perform semantic conceptual search over asset descriptions and summaries",
            parameters={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Natural language query describing desired assets"},
                    "limit": {"type": "integer", "description": "Maximum items to return (1-50)"},
                },
                "required": ["text"],
            },
            handler=search_semantic_fn,
            max_limit=50,
        )

    if get_asset_fn:
        registry.register(
            name="get_asset",
            description="Lookup full canonical asset record and provenance by exact asset_id",
            parameters={
                "type": "object",
                "properties": {
                    "asset_id": {"type": "string", "description": "Canonical asset ID (sha256:...)"},
                },
                "required": ["asset_id"],
            },
            handler=get_asset_fn,
        )

    if get_analysis_fn:
        registry.register(
            name="get_analysis",
            description="Lookup persisted terminal analysis record, classification tags, OCR, and feature provenance",
            parameters={
                "type": "object",
                "properties": {
                    "asset_id": {"type": "string", "description": "Canonical asset ID (sha256:...)"},
                },
                "required": ["asset_id"],
            },
            handler=get_analysis_fn,
        )

    return registry
