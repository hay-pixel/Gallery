"""CLI for local, deployable one-record and reusable batch analysis workers."""

from __future__ import annotations

import argparse
import json
import os
from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import Any

from .backends import BackendUnavailable, TesseractOcrBackend, TorchvisionResNet18Backend
from .models import AssetInput, ContractError
from .service import AnalysisService


def parser() -> argparse.ArgumentParser:
    value = argparse.ArgumentParser(
        prog="ollamabinsaden-analysis",
        description="Analyse canonical image assets into normalized, versioned analysis records.",
    )
    source = value.add_mutually_exclusive_group(required=True)
    source.add_argument("--asset-record", type=Path, help="accepted asset-record-v1 JSON file")
    source.add_argument("--asset-json", help="inline accepted asset-record-v1 JSON object")
    source.add_argument(
        "--asset-records-jsonl",
        type=Path,
        help="newline-delimited accepted asset-record-v1 JSON objects; one backend is reused",
    )
    value.add_argument(
        "--output-root",
        type=Path,
        default=Path(os.environ.get("SORTER_ANALYSIS_OUTPUT_ROOT", "./analysis-output")),
        help="analysis record root (or SORTER_ANALYSIS_OUTPUT_ROOT)",
    )
    value.add_argument(
        "--model-cache",
        type=Path,
        default=Path(os.environ.get("SORTER_ANALYSIS_MODEL_CACHE", "./model-cache")),
        help="pre-provisioned local model cache (or SORTER_ANALYSIS_MODEL_CACHE)",
    )
    value.add_argument(
        "--ocr",
        choices=("off", "tesseract"),
        default=os.environ.get("SORTER_ANALYSIS_OCR", "off"),
        help="optional local OCR backend; default: off",
    )
    value.add_argument(
        "--force", action="store_true", help="re-run even when a compatible analysis record exists"
    )
    value.add_argument(
        "--pretty", action="store_true", help="pretty-print one-record normalized JSON"
    )
    return value


def _coerce_asset_payload(raw_payload: object) -> dict[str, Any]:
    if not isinstance(raw_payload, dict):
        raise TypeError("asset record must be a JSON object")
    return {str(key): value for key, value in raw_payload.items()}


def _asset_payloads(args: argparse.Namespace) -> Iterable[dict[str, Any]]:
    if args.asset_records_jsonl:
        with args.asset_records_jsonl.open(encoding="utf-8") as handle:
            for line_number, line in enumerate(handle, start=1):
                if not line.strip():
                    continue
                try:
                    yield _coerce_asset_payload(json.loads(line))
                except (TypeError, json.JSONDecodeError) as exc:
                    raise ValueError(
                        f"invalid JSONL asset record at line {line_number}: {exc}"
                    ) from exc
        return
    raw_payload = (
        json.loads(args.asset_record.read_text(encoding="utf-8"))
        if args.asset_record
        else json.loads(args.asset_json)
    )
    yield _coerce_asset_payload(raw_payload)


def _is_success_status(status: str) -> bool:
    return status in {"ready", "partial", "unsupported"}


def main(argv: Sequence[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if args.pretty and args.asset_records_jsonl:
        parser().error(
            "--pretty is available only for one-record invocation; JSONL output is one record per line"
        )
    try:
        backend = TorchvisionResNet18Backend(cache_dir=args.model_cache)
        ocr_backend = TesseractOcrBackend() if args.ocr == "tesseract" else None
        service = AnalysisService(
            backend=backend,
            output_root=args.output_root,
            ocr_backend=ocr_backend,
        )
    except BackendUnavailable as exc:
        parser().error(str(exc))

    exit_code = 0
    try:
        payloads = _asset_payloads(args)
        for payload in payloads:
            try:
                asset = AssetInput.from_asset_record(payload)
                result = service.analyse(asset, force=args.force)
                output: dict[str, Any] = result.record.to_dict()
                if not _is_success_status(result.record.status):
                    exit_code = 1
            except (ContractError, OSError, ValueError) as exc:
                output = {"input_error": str(exc)}
                exit_code = 1
            print(json.dumps(output, ensure_ascii=False, indent=2 if args.pretty else None))
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        parser().error(str(exc))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
