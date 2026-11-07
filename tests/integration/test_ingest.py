"""Tests for universal source connector and ingestion engine.

Verifies:
- Canonical asset identification by SHA-256 digest (asset-record-v1).
- Distinct source occurrence tracking per file path (source-occurrence-record-v1).
- Exact duplicate detection: multiple occurrences pointing to one canonical asset.
- Directory scanning and recursive traversal.
- Extract export manifest import and schema conformance.
- Ingestion with automated visual analysis and search index population.
"""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from analysis_service.service import AnalysisService
from search_service import FeatureProfile, VisualSearchService
from services.ingest import (
    CanonicalAssetRecord,
    IngestService,
    SourceOccurrenceRecord,
    compute_file_sha256,
)


def test_compute_file_sha256(tmp_path: Path) -> None:
    test_file = tmp_path / "sample.txt"
    content = b"PixelDrive Universal Catalogue Ingestion"
    test_file.write_bytes(content)

    digest, size = compute_file_sha256(test_file)
    expected_digest = hashlib.sha256(content).hexdigest()
    assert digest == expected_digest
    assert size == len(content)


def test_single_file_ingest(tmp_path: Path) -> None:
    test_file = tmp_path / "photo.jpg"
    content = b"\xFF\xD8\xFF\xE0\x00\x10JFIF" + b"sample image payload"
    test_file.write_bytes(content)

    service = IngestService()
    asset, occurrence, is_new = service.ingest_file(
        file_path=test_file,
        source_id="local_drive_1",
        source_kind="local_folder",
        source_location=str(tmp_path),
        original_path="photo.jpg",
    )

    assert is_new is True
    assert asset.schema == "asset-record"
    assert asset.schema_version == 1
    assert asset.asset_id.startswith("sha256:")
    assert asset.content_hash == asset.asset_id
    assert asset.size_bytes == len(content)
    assert asset.mime_type == "image/jpeg"
    assert asset.processing_state == "ready"

    assert occurrence.schema == "source-occurrence-record"
    assert occurrence.schema_version == 1
    assert occurrence.source_occurrence_id.startswith("occurrence:sha256:")
    assert occurrence.asset_id == asset.asset_id
    assert occurrence.source_id == "local_drive_1"
    assert occurrence.original_path == "photo.jpg"


def test_exact_duplicate_detection(tmp_path: Path) -> None:
    folder_a = tmp_path / "folder_a"
    folder_b = tmp_path / "folder_b"
    folder_a.mkdir()
    folder_b.mkdir()

    content = b"Exact duplicate payload across multiple folders"
    file_a = folder_a / "document.pdf"
    file_b = folder_b / "document_copy.pdf"
    file_a.write_bytes(content)
    file_b.write_bytes(content)

    service = IngestService()

    # First ingest
    asset_1, occ_1, is_new_1 = service.ingest_file(
        file_path=file_a,
        source_id="drive_main",
        original_path="folder_a/document.pdf",
    )
    assert is_new_1 is True

    # Second ingest of duplicate file
    asset_2, occ_2, is_new_2 = service.ingest_file(
        file_path=file_b,
        source_id="drive_backup",
        original_path="folder_b/document_copy.pdf",
    )
    assert is_new_2 is False

    # Same canonical asset, distinct occurrences
    assert asset_1.asset_id == asset_2.asset_id
    assert occ_1.source_occurrence_id != occ_2.source_occurrence_id
    assert occ_1.asset_id == asset_1.asset_id
    assert occ_2.asset_id == asset_1.asset_id
    assert len(service.known_assets) == 1
    assert len(service.known_occurrences) == 2


def test_directory_scan_and_summary(tmp_path: Path) -> None:
    scan_dir = tmp_path / "library"
    scan_dir.mkdir()
    sub_dir = scan_dir / "sub"
    sub_dir.mkdir()

    # 3 distinct files + 1 duplicate
    (scan_dir / "file1.txt").write_bytes(b"File 1 content")
    (scan_dir / "file2.txt").write_bytes(b"File 2 content")
    (sub_dir / "file3.png").write_bytes(b"\x89PNG\r\n\x1a\nfile 3")
    (sub_dir / "file1_copy.txt").write_bytes(b"File 1 content")  # Duplicate of file1

    service = IngestService()
    summary = service.ingest_directory(scan_dir, source_id="local_library", recursive=True)

    assert summary.files_scanned == 4
    assert summary.assets_created == 3
    assert summary.duplicate_occurrences == 1
    assert summary.failed_count == 0
    assert len(service.known_assets) == 3
    assert len(service.known_occurrences) == 4


def test_extract_export_compatibility(tmp_path: Path) -> None:
    export_dir = tmp_path / "extract_export"
    export_dir.mkdir()

    # Create dummy media file
    media_file = export_dir / "item_01.jpg"
    media_bytes = b"sample extract image byte payload"
    media_file.write_bytes(media_bytes)

    digest = hashlib.sha256(media_bytes).hexdigest()
    asset_id = f"sha256:{digest}"

    manifest = {
        "manifest_version": "1.0",
        "source": "Extract",
        "records": [
            {
                "schema": "asset-record",
                "schema_version": 1,
                "asset_id": asset_id,
                "content_hash": asset_id,
                "relative_path": "item_01.jpg",
                "mime_type": "image/jpeg",
                "size_bytes": len(media_bytes),
                "original_path": "/var/data/exports/item_01.jpg",
                "processing_state": "ready",
            }
        ],
    }
    (export_dir / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

    service = IngestService()
    summary = service.import_extract_export(export_dir, source_id="extract_source_1")

    assert summary.files_scanned == 1
    assert summary.assets_created == 1
    assert summary.duplicate_occurrences == 0
    assert asset_id in service.known_assets
    asset = service.known_assets[asset_id]
    assert asset.size_bytes == len(media_bytes)
    assert asset.mime_type == "image/jpeg"

    # Ingest the same extract export again -> should be detected as duplicates
    summary2 = service.import_extract_export(export_dir, source_id="extract_source_1")
    assert summary2.files_scanned == 1
    assert summary2.assets_created == 0
    assert summary2.duplicate_occurrences == 1


from analysis_service.backends import FeatureSpec, VisualObservation
from analysis_service.models import ConfidenceLabel, RuntimeDescriptor


class MockBackend:
    @property
    def descriptor(self) -> RuntimeDescriptor:
        return RuntimeDescriptor("gallery/ingest-test", "1.0", "gallery/vector", "1.0", "cpu")

    @property
    def feature_spec(self) -> FeatureSpec:
        return FeatureSpec(
            feature_type="image_embedding",
            feature_model_id="torchvision/resnet18",
            feature_model_version="imagenet1k_v1",
            feature_extractor_revision="torchvision-resnet18-preclassifier-512-l2-v1",
            similarity_family="cosine",
            normalization={"kind": "l2", "applied": True},
        )

    def analyse_image(self, path: Path, _source_content_hash: str) -> VisualObservation:
        return VisualObservation(
            labels=[ConfidenceLabel("mountain", 0.95, "classifier")],
            feature_values=[0.1] * 512,
        )


def test_ingest_with_auto_analyse(tmp_path: Path) -> None:
    output_root = tmp_path / "analysis_store"
    search_db = tmp_path / "search.sqlite3"

    analyser = AnalysisService(output_root=output_root, backend=MockBackend())
    search = VisualSearchService(search_db)

    from PIL import Image

    img_file = tmp_path / "landscape.jpg"
    img = Image.new("RGB", (32, 32), color="green")
    img.save(img_file, format="JPEG")

    service = IngestService(analysis_service=analyser, search_service=search)
    asset, _, is_new = service.ingest_file(
        file_path=img_file,
        source_id="camera_sd",
        auto_analyse=True,
    )

    assert is_new is True
    # Verify visual similarity search returns this asset
    profile = FeatureProfile(
        feature_type="image_embedding",
        feature_model_id="torchvision/resnet18",
        feature_model_version="imagenet1k_v1",
        feature_extractor_revision="torchvision-resnet18-preclassifier-512-l2-v1",
        dimensions=512,
        similarity_family="cosine",
        normalization={"kind": "l2", "applied": True},
    )
    similar = search.find_visually_similar(asset.asset_id, profile, limit=5, include_seed=True)
    assert len(similar) == 1
    assert similar[0].asset_id == asset.asset_id
    assert similar[0].score > 0.99
    search.close()
