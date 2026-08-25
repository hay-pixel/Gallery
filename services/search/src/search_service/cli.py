"""Local operator CLI for the persistent Search service."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence
from pathlib import Path

from .models import FeatureProfile, SearchError
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


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Inspect persistent visual Search state.")
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
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    arguments = _parser().parse_args(argv)
    try:
        with VisualSearchService(arguments.database) as service:
            payload = service.health() if arguments.command == "health" else service.get_index_status(_profile_from_arguments(arguments)).to_dict()
    except SearchError as error:
        print(json.dumps({"service": "search", "status": "unavailable", "detail": str(error)}))
        return 2
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
