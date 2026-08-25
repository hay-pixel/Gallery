"""Run a documented local-model evaluation against an operator-supplied image fixture."""

from __future__ import annotations

import argparse
import hashlib
import json
import time
from collections.abc import Sequence
from pathlib import Path

from analysis_service.backends import TorchvisionResNet18Backend, vector_norm
from analysis_service.models import AssetInput
from analysis_service.service import AnalysisService

ROOT = Path(__file__).resolve().parents[1]


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(description="Evaluate the selected local analysis runtime.")
    value.add_argument("asset_path", type=Path, help="a locally available decodable image fixture")
    value.add_argument(
        "--output-root",
        type=Path,
        default=ROOT / ".runtime-evaluation-output",
        help="where to persist the normalized evaluation record",
    )
    value.add_argument(
        "--model-cache",
        type=Path,
        default=ROOT / ".runtime-model-cache",
        help="local Torch model cache",
    )
    return value


def main(argv: Sequence[str] | None = None) -> int:
    args = parser().parse_args(argv)
    fixture: Path = args.asset_path
    if not fixture.is_file():
        parser().error(f"fixture is not a regular file: {fixture}")
    content_hash = "sha256:" + hashlib.sha256(fixture.read_bytes()).hexdigest()
    asset = AssetInput(
        asset_id=content_hash,
        expected_content_hash=content_hash,
        storage_locator=str(fixture.resolve()),
        mime_type="image/jpeg",
    )
    started = time.perf_counter()
    backend = TorchvisionResNet18Backend(cache_dir=args.model_cache)
    loaded_seconds = time.perf_counter() - started
    started = time.perf_counter()
    service = AnalysisService(backend=backend, output_root=args.output_root)
    result = service.analyse(asset, force=True)
    inference_seconds = time.perf_counter() - started
    feature = result.record.visual_features[0] if result.record.visual_features else None
    output = {
        "fixture": str(fixture.resolve()),
        "fixture_sha256": content_hash,
        "model": result.record.analyser.to_dict(),
        "status": result.record.status,
        "summary": result.record.summary,
        "analysis_id": result.record.analysis_id,
        "result_id": result.record.result_id,
        "expected_content_hash": result.record.expected_content_hash,
        "input_content_hash": result.record.input_content_hash,
        "objects": [item.to_dict() for item in result.record.objects],
        "categories": [item.to_dict() for item in result.record.categories],
        "tags": [item.to_dict() for item in result.record.tags],
        "feature_dimensions": feature.dimensions if feature else None,
        "feature_l2_norm": round(vector_norm(feature.values or []), 6) if feature else None,
        "model_load_seconds": round(loaded_seconds, 3),
        "analysis_seconds": round(inference_seconds, 3),
        "persisted_record": str(result.record_path) if result.record_path else None,
    }
    print(json.dumps(output, indent=2))
    return 0 if result.record.status in {"ready", "partial"} else 1


if __name__ == "__main__":
    raise SystemExit(main())
