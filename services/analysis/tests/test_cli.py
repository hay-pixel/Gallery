from __future__ import annotations

import hashlib
import json
from pathlib import Path

from analysis_service import cli
from analysis_service.models import AssetInput


def _asset_record(asset: AssetInput, source_path: Path) -> dict[str, object]:
    return {
        "schema": "asset-record",
        "schema_version": 1,
        "asset_id": asset.asset_id,
        "storage_locator": str(source_path),
        "mime_type": asset.mime_type,
        "size_bytes": source_path.stat().st_size,
        "content_hash": asset.expected_content_hash,
        "processing_state": "ready",
    }


def test_jsonl_batch_initializes_one_backend_for_multiple_assets(
    capsys: object,
    monkeypatch: object,
    tmp_path: Path,
    canonical_image: tuple[Path, AssetInput],
    stub_backend: object,
) -> None:
    first_path, first_asset = canonical_image
    second_path = tmp_path / "second-canonical.png"
    second_path.write_bytes(first_path.read_bytes() + b"second-canonical-asset")
    second_digest = "sha256:" + hashlib.sha256(second_path.read_bytes()).hexdigest()
    second_asset = AssetInput(second_digest, second_digest, str(second_path), "image/png")
    manifest = tmp_path / "assets.jsonl"
    manifest.write_text(
        "\n".join(
            json.dumps(record)
            for record in (
                _asset_record(first_asset, first_path),
                _asset_record(second_asset, second_path),
            )
        )
        + "\n",
        encoding="utf-8",
    )

    initializations = 0

    def build_backend(*, cache_dir: Path) -> object:
        nonlocal initializations
        initializations += 1
        assert cache_dir == tmp_path / "model-cache"
        return stub_backend

    monkeypatch.setattr(cli, "TorchvisionResNet18Backend", build_backend)  # type: ignore[attr-defined]
    exit_code = cli.main(
        [
            "--asset-records-jsonl",
            str(manifest),
            "--output-root",
            str(tmp_path / "analysis"),
            "--model-cache",
            str(tmp_path / "model-cache"),
        ]
    )
    stdout = capsys.readouterr().out.splitlines()  # type: ignore[attr-defined]

    assert exit_code == 0
    assert initializations == 1
    assert stub_backend.calls == 2  # type: ignore[attr-defined]
    assert len(stdout) == 2
    assert all(json.loads(line)["status"] == "ready" for line in stdout)
