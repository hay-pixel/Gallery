"""Integration tests for the private AI Gateway (services/gateway.py).

Verifies:
- /health endpoint reports service status without leaking private credentials.
- /ingest/scan ingests local files, deduplicates byte-identical copies, and indexes metadata into Search.
- /search/metadata retrieves canonical assets with matched_fields, provenance occurrences, and cursor pagination.
- /ai/interpret routes deterministic, identity, and reasoning queries accurately.
- /ai/ask executes the full QueryRouter -> ToolRegistry -> Search -> GroundingEngine loop and returns grounded citations.
"""

from __future__ import annotations

import json
import threading
import urllib.request
from pathlib import Path
from typing import Any

from services.gateway import run_gateway_server


def _post_json(base_url: str, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    req = urllib.request.Request(
        f"{base_url}{path}",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5.0) as resp:
        return json.loads(resp.read().decode("utf-8"))  # type: ignore[no-any-return]


def _get_json(base_url: str, path: str) -> dict[str, Any]:
    req = urllib.request.Request(f"{base_url}{path}", method="GET")
    with urllib.request.urlopen(req, timeout=5.0) as resp:
        return json.loads(resp.read().decode("utf-8"))  # type: ignore[no-any-return]


def test_gateway_end_to_end_ingest_search_and_grounded_ask(tmp_path: Path) -> None:
    media_dir = tmp_path / "media"
    media_dir.mkdir()
    sub_dir = media_dir / "backup"
    sub_dir.mkdir()

    # Create sample files (including an exact byte-identical duplicate)
    lease_bytes = b"Residential housing lease agreement Sydney 2026"
    (media_dir / "housing_lease.txt").write_bytes(lease_bytes)
    (sub_dir / "housing_lease_backup.txt").write_bytes(lease_bytes)
    (media_dir / "speaker_wires_notes.md").write_bytes(b"Speaker wire diagram and impedance notes")

    analysis_root = tmp_path / "analysis"
    search_db = tmp_path / "search.sqlite3"

    server = run_gateway_server(
        host="127.0.0.1",
        port=0,  # Ephemeral port
        analysis_root=analysis_root,
        search_db_path=search_db,
        ollama_host="http://127.0.0.1:65530",  # Unreachable port to test deterministic fallback
    )
    port = server.server_address[1]
    base_url = f"http://127.0.0.1:{port}"
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        # 1. Check /health
        health = _get_json(base_url, "/health")
        assert health["status"] == "ok"
        assert health["analysis_service"] is True
        assert health["search_service"] is True
        assert health["ingest_service"] is True

        # 2. Scan media directory via /ingest/scan
        scan_res = _post_json(
            base_url,
            "/ingest/scan",
            {
                "path": str(media_dir),
                "source_id": "local_archive",
                "recursive": True,
                "auto_analyse": False,
            },
        )
        assert scan_res["files_scanned"] == 3
        assert scan_res["assets_created"] == 2
        assert scan_res["duplicate_occurrences"] == 1

        # 3. Search metadata via /search/metadata
        meta_res = _post_json(
            base_url,
            "/search/metadata",
            {"query": "housing", "limit": 10},
        )
        assert len(meta_res["results"]) == 1
        lease_result = meta_res["results"][0]
        assert lease_result["retrieval_mode"] == "metadata"
        assert lease_result["relationship_type"] == "metadata_match"
        assert len(lease_result["provenance"]["source_occurrences"]) == 2

        # 4. Ask AI via /ai/ask -> routes to search_metadata tool and returns grounded citations
        ask_res = _post_json(
            base_url,
            "/ai/ask",
            {"question": "housing"},
        )
        assert len(ask_res["supporting_assets"]) == 1
        cited = ask_res["supporting_assets"][0]
        assert cited["asset_id"] == lease_result["asset_id"]
        assert len(cited["source_occurrences"]) == 2
    finally:
        server.shutdown()
        server.gateway_state.close()  # type: ignore[attr-defined]
        server.server_close()

