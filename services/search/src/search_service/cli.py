"""Local operator CLI for the persistent Search service."""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from .analysis_adapter import visual_feature_input_from_analysis
from .models import ContractError, FeatureProfile, SearchError
from .service import VisualSearchService


def _profile_from_arguments(arguments: argparse.Namespace) -> FeatureProfile:
    return FeatureProfile(
        feature_type=arguments.feature_type,
        feature_model_id=arguments.feature_model_id,
        feature_model_version=arguments.feature_model_version,
        feature_extractor_revision=arguments.feature_extractor_revision,
        dimensions=arguments.dimensions,
        similarity_family="cosine",
        normalization={"kind": arguments.normalization_kind, "applied": arguments.normalization_applied},
    )


def _read_json(path: str) -> dict[str, Any]:
    try:
        raw = sys.stdin.read() if path == "-" else Path(path).read_text(encoding="utf-8")
        payload = json.loads(raw)
    except (OSError, json.JSONDecodeError) as error:
        raise ContractError(f"unable to read Analysis feature JSON: {error}") from error
    if not isinstance(payload, dict):
        raise ContractError("Analysis feature JSON must contain an object")
    return payload


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Inspect and operate persistent visual Search state.")
    parser.add_argument("--database", type=Path, default=Path("./data/search/visual-index.sqlite3"))
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("health", help="Show all local visual index profile health summaries.")
    status = commands.add_parser("status", help="Show one visual profile index status.")
    status.add_argument("--feature-type", required=True)
    status.add_argument("--feature-model-id", required=True)
    status.add_argument("--feature-model-version", required=True)
    status.add_argument("--feature-extractor-revision", required=True)
    status.add_argument("--dimensions", type=int, required=True)
    status.add_argument("--normalization-kind", required=True)
    status.add_argument("--normalization-applied", action="store_true")
    index_feature = commands.add_parser(
        "index-analysis-feature", help="Index one serialized inline Analysis VisualFeature v1 record."
    )
    index_feature.add_argument("--feature-json", required=True, help="JSON file path or '-' for stdin")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = _parser().parse_args(argv)
    try:
        with VisualSearchService(arguments.database) as service:
            if arguments.command == "health":
                payload: dict[str, Any] = service.health()
            elif arguments.command == "status":
                payload = service.get_index_status(_profile_from_arguments(arguments)).to_dict()
            else:
                feature = visual_feature_input_from_analysis(_read_json(arguments.feature_json))
                changed = service.index_visual_feature(feature)
                status = service.get_index_status(feature.profile)
                payload = {
                    "asset_id": feature.asset_id,
                    "feature_id": feature.feature_id,
                    "analysis_id": feature.analysis_id,
                    "analysis_result_id": feature.analysis_result_id,
                    "index_id": feature.profile.index_id,
                    "index_version": status.index_version,
                    "changed": changed,
                }
    except SearchError as error:
        print(json.dumps({"service": "search", "status": "unavailable", "detail": str(error)}))
        return 2
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
