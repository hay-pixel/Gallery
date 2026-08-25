"""Benchmark local visual Search with deterministic fixture embeddings.

The generated vectors are evaluation data only. Production vectors must come from the
accepted visual-analysis boundary and retain their associated canonical asset metadata.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import resource
import time
from collections.abc import Sequence
from pathlib import Path
from typing import Any

import numpy as np

from search_service import FeatureProfile, VisualFeatureInput, VisualSearchService


def canonical_id(index: int) -> str:
    digest = hashlib.sha256(f"benchmark-asset-{index}".encode()).hexdigest()
    return f"sha256:{digest}"


def fixture_vector(index: int, dimension: int) -> list[float]:
    """Create a deterministic non-zero vector without external model dependencies."""
    positions = np.arange(dimension, dtype=np.float32)
    vector = np.sin((index + 1) * (positions + 1) * 0.017) + np.cos(
        (index + 3) * (positions + 1) * 0.013
    )
    return vector.astype(np.float32).tolist()


def features_for(scale: int, profile: FeatureProfile) -> list[VisualFeatureInput]:
    return [
        VisualFeatureInput(
            asset_id=canonical_id(index),
            input_content_hash=canonical_id(index),
            profile=profile,
            values=fixture_vector(index, profile.dimensions),
            feature_id=f"benchmark-feature-{index}",
            analysis_id="analysis:benchmark-logical-v1",
            analysis_result_id=f"analysis-result:benchmark-{index}",
            generated_at="2026-08-25T00:00:00Z",
        )
        for index in range(scale)
    ]


def memory_bytes() -> int:
    usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return int(usage * 1024)


def run_scale(output_root: Path, scale: int, dimension: int, query_count: int) -> dict[str, Any]:
    profile = FeatureProfile(
        feature_type="image_embedding",
        feature_model_id="deterministic-fixture",
        feature_model_version="1.0.0",
        feature_extractor_revision="benchmark-extractor-v1",
        dimensions=dimension,
        similarity_family="cosine",
        normalization={"kind": "l2", "applied": False},
    )
    database = output_root / f"visual-{scale}.sqlite3"
    database.unlink(missing_ok=True)
    database.with_name(f"{database.name}-wal").unlink(missing_ok=True)
    database.with_name(f"{database.name}-shm").unlink(missing_ok=True)

    prepare_started = time.perf_counter()
    features = features_for(scale, profile)
    preparation_seconds = time.perf_counter() - prepare_started

    with VisualSearchService(database) as service:
        indexing_started = time.perf_counter()
        status = service.rebuild_from_features(profile, features)
        indexing_seconds = time.perf_counter() - indexing_started

        query_started = time.perf_counter()
        for index in range(min(query_count, scale)):
            service.find_visually_similar(features[index].asset_id, profile, limit=20)
        query_seconds = time.perf_counter() - query_started

    executed_queries = min(query_count, scale)
    return {
        "scale": scale,
        "dimension": dimension,
        "fixture_preparation_seconds": round(preparation_seconds, 6),
        "indexing_seconds": round(indexing_seconds, 6),
        "indexing_vectors_per_second": round(scale / indexing_seconds, 2),
        "query_count": executed_queries,
        "mean_query_latency_ms": round((query_seconds / executed_queries) * 1000, 3),
        "database_size_bytes": database.stat().st_size,
        "peak_process_memory_bytes": memory_bytes(),
        "active_vector_count": status.active_vector_count,
        "index_version": status.index_version,
    }


def parser() -> argparse.ArgumentParser:
    command = argparse.ArgumentParser(description="Benchmark persistent visual Search indexes.")
    command.add_argument("--output-dir", type=Path, default=Path("./benchmark-output"))
    command.add_argument("--scales", type=int, nargs="+", default=[1_000, 10_000, 100_000])
    command.add_argument("--dimension", type=int, default=64)
    command.add_argument("--query-count", type=int, default=20)
    command.add_argument("--json-output", type=Path)
    return command


def main(argv: Sequence[str] | None = None) -> int:
    arguments = parser().parse_args(argv)
    if any(scale < 2 for scale in arguments.scales):
        raise SystemExit("all benchmark scales must be at least two")
    if arguments.dimension < 1 or arguments.query_count < 1:
        raise SystemExit("dimension and query-count must be positive")
    arguments.output_dir.mkdir(parents=True, exist_ok=True)
    results = [
        run_scale(arguments.output_dir, scale, arguments.dimension, arguments.query_count)
        for scale in arguments.scales
    ]
    payload = {
        "technology": "SQLite durable vector store plus in-process NumPy cosine ranking",
        "metrics": results,
        "output_directory": str(arguments.output_dir.resolve()),
    }
    encoded = json.dumps(payload, indent=2, sort_keys=True)
    print(encoded)
    if arguments.json_output is not None:
        arguments.json_output.parent.mkdir(parents=True, exist_ok=True)
        arguments.json_output.write_text(encoded + "\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
