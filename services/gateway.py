"""Private AI Service Gateway daemon for Gallery.

Binds strictly to localhost (127.0.0.1:8000). Never exposes raw ports externally.
Exposes internal RPC endpoints for Node.js / tRPC backend:
- GET  /health
- POST /ai/ask
- POST /ai/interpret
- POST /search/similar
- POST /analysis/analyze
"""

from __future__ import annotations

import argparse
import json
import logging
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from ollama_service import (  # type: ignore[import-untyped]
    AssetContext,
    OllamaService,
    SourceOccurrenceEvidence,
    create_default_tool_registry,
)
from search_service import (  # type: ignore[import-untyped]
    FeatureProfile,
    MetadataDocumentInput,
    VisualSearchService,
    visual_feature_input_from_analysis,
)

from services.ingest import IngestService

logger = logging.getLogger("gallery.ai_gateway")

DEFAULT_GATEWAY_HOST = "127.0.0.1"
DEFAULT_GATEWAY_PORT = 8000


class AIGatewayState:
    """Holds active instances of Analysis, Search, and Ollama services."""

    def __init__(
        self,
        analysis_root: str | Path = "/tmp/gallery_analysis",
        search_db_path: str | Path = "/tmp/gallery_search.sqlite3",
        ollama_host: str = "http://127.0.0.1:11434",
    ) -> None:
        self.analysis_root = Path(analysis_root)
        self.search_db_path = Path(search_db_path)
        self.ollama_host = ollama_host

        try:
            from analysis_service.service import AnalysisService  # type: ignore[import-untyped]

            self.analysis: Any = AnalysisService(output_root=self.analysis_root)
        except Exception:
            self.analysis = None

        self.search = VisualSearchService(self.search_db_path)
        self.ingest = IngestService(analysis_service=self.analysis, search_service=self.search)

        def _doc_to_context(doc: MetadataDocumentInput, source: str = "search") -> AssetContext:
            return AssetContext(
                asset_id=doc.asset_id,
                original_path=doc.original_path,
                mime_type=doc.mime_type,
                size_bytes=doc.size_bytes,
                category=doc.category,
                subcategory=doc.subcategory,
                tags=tuple(doc.tags),
                ocr_text=doc.ocr_text,
                summary=doc.summary,
                analysis_id=doc.analysis_id,
                analysis_result_id=doc.analysis_result_id,
                evidence_source=source,
                source_occurrences=tuple(
                    SourceOccurrenceEvidence(
                        source_occurrence_id=occ.source_occurrence_id,
                        source_id=occ.source_id,
                        original_path=occ.original_path,
                    )
                    for occ in doc.source_occurrences
                ),
            )

        def search_metadata_impl(
            query: str = "",
            category: str = "",
            mime_type: str = "",
            filters: dict[str, Any] | None = None,
            limit: int = 50,
            **_kwargs: Any,
        ) -> list[AssetContext]:
            effective_filters: dict[str, Any] = dict(filters or {})
            if category:
                effective_filters["category"] = category
            if mime_type:
                effective_filters["mime_type"] = mime_type
            page = self.search.search_metadata(
                query=query, filters=effective_filters, limit=limit
            )
            contexts: list[AssetContext] = []
            for res in page.results:
                doc = self.search.get_metadata(res.asset_id)
                if doc is not None:
                    contexts.append(_doc_to_context(doc, source="search"))
            return contexts

        def get_asset_impl(asset_id: str) -> AssetContext | None:
            doc = self.search.get_metadata(asset_id)
            if doc is not None:
                return _doc_to_context(doc, source="get_asset")
            known = self.ingest.known_assets.get(asset_id)
            if known is not None:
                return AssetContext(
                    asset_id=known.asset_id,
                    original_path=known.storage_locator,
                    mime_type=known.mime_type,
                    size_bytes=known.size_bytes,
                    evidence_source="get_asset",
                )
            return None

        # Build tools for Ollama
        def find_visually_similar_impl(asset_id: str, limit: int = 20) -> list[dict[str, Any]]:
            # Default to image-v1 profile
            profile = FeatureProfile(
                feature_type="image_embedding",
                feature_model_id="torchvision/resnet18",
                feature_model_version="imagenet1k_v1",
                feature_extractor_revision="torchvision-resnet18-preclassifier-512-l2-v1",
                dimensions=512,
                similarity_family="cosine",
                normalization={"kind": "l2", "applied": True},
            )
            try:
                results = self.search.find_visually_similar(asset_id, profile, limit=limit)
                return [
                    {
                        "asset_id": r.asset_id,
                        "score": r.score,
                        "analysis_id": r.analysis_id,
                        "analysis_result_id": r.analysis_result_id,
                    }
                    for r in results
                ]
            except (OSError, ValueError, TypeError, KeyError) as exc:
                logger.warning("find_visually_similar tool error: %s", exc)
                return []

        tools = create_default_tool_registry(
            search_metadata_fn=search_metadata_impl,
            find_visually_similar_fn=find_visually_similar_impl,
            get_asset_fn=get_asset_impl,
        )

        self.ollama = OllamaService(host=self.ollama_host, tools=tools)

    def close(self) -> None:
        self.search.close()


class AIGatewayRequestHandler(BaseHTTPRequestHandler):
    """Handles internal HTTP requests from Node.js backend."""

    server_version = "GalleryAIGateway/1.0"

    @property
    def gateway(self) -> AIGatewayState:
        return self.server.gateway_state  # type: ignore[attr-defined]

    def _send_json(self, status: int, data: dict[str, Any]) -> None:
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict[str, Any]:
        content_len = int(self.headers.get("Content-Length", 0))
        if content_len <= 0:
            return {}
        raw = self.wfile if False else self.rfile.read(content_len)
        return json.loads(raw.decode("utf-8"))  # type: ignore[no-any-return]

    def do_GET(self) -> None:
        if self.path == "/health":
            ollama_health = self.gateway.ollama.health()
            self._send_json(HTTPStatus.OK, {
                "status": "ok",
                "analysis_service": True,
                "search_service": True,
                "ingest_service": True,
                "ollama": ollama_health.to_dict(),
            })
            return
        self._send_json(HTTPStatus.NOT_FOUND, {"error": "Endpoint not found"})

    def do_POST(self) -> None:
        try:
            payload = self._read_json()
        except (OSError, json.JSONDecodeError, UnicodeDecodeError, ValueError) as exc:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": f"Invalid JSON payload: {exc}"})
            return

        try:
            if self.path == "/ai/ask":
                question = str(payload.get("question", "")).strip()
                if not question:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Question is required"})
                    return
                context = payload.get("context")
                answer = self.gateway.ollama.ask(question, context=context)
                self._send_json(HTTPStatus.OK, answer.to_dict())
                return

            if self.path == "/ai/interpret":
                query = str(payload.get("query", "")).strip()
                if not query:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Query is required"})
                    return
                context = payload.get("context")
                plan = self.gateway.ollama.interpret_query(query, context=context)
                self._send_json(HTTPStatus.OK, plan.to_dict())
                return

            if self.path == "/search/metadata":
                query = str(payload.get("query", "")).strip()
                filters = payload.get("filters")
                limit = int(payload.get("limit", 50))
                cursor = payload.get("cursor")
                page = self.gateway.search.search_metadata(
                    query=query,
                    filters=filters if isinstance(filters, dict) else None,
                    limit=limit,
                    cursor=str(cursor) if cursor else None,
                )
                self._send_json(HTTPStatus.OK, page.to_dict())
                return

            if self.path == "/search/similar":
                asset_id = str(payload.get("asset_id", "")).strip()
                limit = int(payload.get("limit", 20))
                # Build profile
                profile = FeatureProfile(
                    feature_type="image_embedding",
                    feature_model_id="torchvision/resnet18",
                    feature_model_version="imagenet1k_v1",
                    feature_extractor_revision="torchvision-resnet18-preclassifier-512-l2-v1",
                    dimensions=512,
                    similarity_family="cosine",
                    normalization={"kind": "l2", "applied": True},
                )
                results = self.gateway.search.find_visually_similar(asset_id, profile, limit=limit)
                self._send_json(HTTPStatus.OK, {
                    "results": [
                        {
                            "asset_id": r.asset_id,
                            "score": r.score,
                            "relationship": r.relationship_type,
                            "analysis_id": r.analysis_id,
                            "analysis_result_id": r.analysis_result_id,
                        }
                        for r in results
                    ]
                })
                return

            if self.path == "/analysis/analyze":
                from analysis_service.models import AssetInput  # type: ignore[import-untyped]

                asset_id = str(payload.get("asset_id", "")).strip()
                storage_locator = str(payload.get("storage_locator", "")).strip()
                mime_type = payload.get("mime_type")
                asset = AssetInput(asset_id, asset_id, storage_locator, mime_type)
                outcome = self.gateway.analysis.analyse(asset)
                # Automatically index visual feature into Search if available
                if outcome.record.visual_features:
                    feat_input = visual_feature_input_from_analysis(outcome.record.visual_features[0].to_dict())
                    self.gateway.search.index_visual_feature(feat_input)

                self._send_json(HTTPStatus.OK, {
                    "status": outcome.record.status,
                    "analysis_id": outcome.record.analysis_id,
                    "result_id": outcome.record.result_id,
                    "tags": [t.to_dict() for t in outcome.record.tags],
                    "categories": [c.to_dict() for c in outcome.record.categories],
                    "summary": outcome.record.summary,
                    "visual_features_count": len(outcome.record.visual_features),
                })
                return

            if self.path == "/ingest/scan":
                folder_path = str(payload.get("path", "")).strip()
                if not folder_path:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Path is required"})
                    return
                source_id = str(payload.get("source_id", "local_folder")).strip()
                recursive = bool(payload.get("recursive", True))
                auto_analyse = bool(payload.get("auto_analyse", True))
                summary = self.gateway.ingest.ingest_directory(
                    folder_path,
                    source_id=source_id,
                    recursive=recursive,
                    auto_analyse=auto_analyse,
                )
                self._send_json(HTTPStatus.OK, summary.to_dict())
                return

            if self.path == "/ingest/import-extract":
                export_path = str(payload.get("path", "")).strip()
                if not export_path:
                    self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Path is required"})
                    return
                source_id = str(payload.get("source_id", "extract_export")).strip()
                summary = self.gateway.ingest.import_extract_export(
                    export_path,
                    source_id=source_id,
                )
                self._send_json(HTTPStatus.OK, summary.to_dict())
                return

            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Endpoint not found"})

        except Exception as exc:
            logger.exception("Gateway request handling failed on %s", self.path)
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc), "error_class": exc.__class__.__name__})


def run_gateway_server(
    host: str = DEFAULT_GATEWAY_HOST,
    port: int = DEFAULT_GATEWAY_PORT,
    *,
    analysis_root: str | Path = "/tmp/gallery_analysis",
    search_db_path: str | Path = "/tmp/gallery_search.sqlite3",
    ollama_host: str = "http://127.0.0.1:11434",
) -> ThreadingHTTPServer:
    """Instantiate and bind the private AI Gateway server."""
    state = AIGatewayState(
        analysis_root=analysis_root,
        search_db_path=search_db_path,
        ollama_host=ollama_host,
    )
    server = ThreadingHTTPServer((host, port), AIGatewayRequestHandler)
    server.gateway_state = state  # type: ignore[attr-defined]
    return server


def main() -> None:
    parser = argparse.ArgumentParser(description="Gallery private AI Gateway Daemon")
    parser.add_argument("--host", default=DEFAULT_GATEWAY_HOST, help="Host to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=DEFAULT_GATEWAY_PORT, help="Port to bind (default: 8000)")
    parser.add_argument("--analysis-root", default="/tmp/gallery_analysis", help="Root directory for analysis records")
    parser.add_argument("--search-db", default="/tmp/gallery_search.sqlite3", help="Path to SQLite search database")
    parser.add_argument("--ollama-host", default="http://127.0.0.1:11434", help="URL of Ollama daemon")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    logger.info("Starting AI Gateway on http://%s:%d", args.host, args.port)

    server = run_gateway_server(
        host=args.host,
        port=args.port,
        analysis_root=args.analysis_root,
        search_db_path=args.search_db,
        ollama_host=args.ollama_host,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down AI Gateway...")
    finally:
        server.gateway_state.close()  # type: ignore[attr-defined]
        server.server_close()


if __name__ == "__main__":
    main()
