"""Low-level private client for Ollama runtime at 127.0.0.1:11434.

Strict privacy rule: Ollama inference is strictly private to localhost.
Never exposes raw endpoints or credentials to external clients.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Any

from .models import (
    ModelCapabilities,
    ModelInfo,
    ModelUnavailableError,
    OllamaHealth,
    OllamaUnavailableError,
)

DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434"


class OllamaClient:
    """Internal client communicating with the private local Ollama daemon."""

    def __init__(
        self,
        host: str = DEFAULT_OLLAMA_HOST,
        *,
        timeout_seconds: float = 30.0,
    ) -> None:
        self.host = host.rstrip("/")
        self.timeout_seconds = timeout_seconds

    def _request(
        self,
        endpoint: str,
        *,
        method: str = "GET",
        payload: dict[str, Any] | None = None,
        timeout: float | None = None,
    ) -> dict[str, Any]:
        url = f"{self.host}{endpoint}"
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        req_timeout = timeout or self.timeout_seconds
        try:
            with urllib.request.urlopen(req, timeout=req_timeout) as resp:
                body = resp.read().decode("utf-8")
                if not body.strip():
                    return {}
                return json.loads(body)  # type: ignore[no-any-return]
        except urllib.error.HTTPError as exc:
            err_body = exc.read().decode("utf-8", errors="replace")
            if exc.code == 404:
                raise ModelUnavailableError(f"Ollama resource or model not found: {err_body}") from exc
            raise OllamaUnavailableError(f"Ollama HTTP error {exc.code}: {err_body}") from exc
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise OllamaUnavailableError(
                f"Cannot connect to private Ollama daemon at {self.host}: {exc}"
            ) from exc

    def health(self) -> OllamaHealth:
        """Check reachability and version of private Ollama instance."""
        start = time.perf_counter()
        try:
            res = self._request("/api/version", timeout=3.0)
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            version = str(res.get("version", "unknown"))
            return OllamaHealth(
                reachable=True,
                status="available",
                host=self.host,
                version=version,
                latency_ms=elapsed_ms,
            )
        except (OllamaUnavailableError, urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
            return OllamaHealth(
                reachable=False,
                status="unavailable",
                host=self.host,
                latency_ms=elapsed_ms,
                error_message=str(exc),
            )

    def list_models(self) -> list[ModelInfo]:
        """List local models installed in Ollama."""
        data = self._request("/api/tags")
        raw_models = data.get("models", [])
        models: list[ModelInfo] = []
        for item in raw_models:
            models.append(
                ModelInfo(
                    name=str(item.get("name", "")),
                    modified_at=item.get("modified_at"),
                    size_bytes=int(item.get("size", 0)),
                    digest=item.get("digest"),
                )
            )
        return models

    def capabilities(self, model_id: str) -> ModelCapabilities:
        """Determine capabilities of a configured model ID."""
        normalized = model_id.lower()
        is_embed = "embed" in normalized
        is_vision = any(v in normalized for v in ("llava", "vision", "moondream", "minicpm"))
        return ModelCapabilities(
            model_id=model_id,
            supports_completion=not is_embed,
            supports_chat=not is_embed,
            supports_embeddings=is_embed or "llama" in normalized,
            supports_tools=not is_embed and ("llama3" in normalized or "mistral" in normalized or "qwen" in normalized),
            supports_vision=is_vision,
        )

    def embed(self, model: str, input_text: str | list[str]) -> list[list[float]]:
        """Obtain embeddings from Ollama embedding model."""
        payload = {"model": model, "input": input_text}
        try:
            res = self._request("/api/embed", method="POST", payload=payload)
            embeddings = res.get("embeddings")
            if embeddings and isinstance(embeddings, list):
                return [[float(x) for x in emb] for emb in embeddings]
        except Exception:
            # Fallback to legacy /api/embeddings endpoint
            if isinstance(input_text, str):
                res = self._request("/api/embeddings", method="POST", payload={"model": model, "prompt": input_text})
                emb = res.get("embedding", [])
                return [[float(x) for x in emb]]
            raise
        return []

    def chat(
        self,
        model: str,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        format_json: bool = False,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        """Send a chat completion request to Ollama."""
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature},
        }
        if format_json:
            payload["format"] = "json"
        if tools:
            payload["tools"] = tools
        return self._request("/api/chat", method="POST", payload=payload)
