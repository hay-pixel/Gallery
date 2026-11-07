"""Ollama Service: permanent private reasoning, query interpretation, and grounded answers."""

from .client import OllamaClient
from .grounding import GroundingEngine
from .models import (
    AssetContext,
    CombineStrategy,
    GroundedAnswer,
    ModelCapabilities,
    ModelInfo,
    OllamaContractError,
    OllamaHealth,
    OllamaUnavailableError,
    QueryOperation,
    QueryPlan,
    SourceOccurrenceEvidence,
    SupportingAsset,
    WebContext,
)
from .router import QueryRouter
from .service import OllamaService
from .tools import ToolAuditLog, ToolDefinition, ToolRegistry, create_default_tool_registry

__all__ = [
    "AssetContext",
    "CombineStrategy",
    "GroundedAnswer",
    "GroundingEngine",
    "ModelCapabilities",
    "ModelInfo",
    "OllamaClient",
    "OllamaContractError",
    "OllamaHealth",
    "OllamaService",
    "OllamaUnavailableError",
    "QueryOperation",
    "QueryPlan",
    "QueryRouter",
    "SourceOccurrenceEvidence",
    "SupportingAsset",
    "ToolAuditLog",
    "ToolDefinition",
    "ToolRegistry",
    "WebContext",
    "create_default_tool_registry",
]
