"""Source connector and ingestion engine for Gallery.

Implements Milestone 1 and contracts/ pinned schemas:
- Computes canonical asset identity (sha256:<64 hex>).
- Tracks every source occurrence with deterministic IDs (occurrence:sha256:<64 hex>).
- Detects exact byte-identical duplicates without duplicating canonical assets.
- Ingests local files/directories and imports Extract export manifests.
- Connects directly with AnalysisService and VisualSearchService if enabled.
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import logging
import mimetypes
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger("gallery.ingest")

HEX_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
ASSET_ID_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
OCCURRENCE_ID_RE = re.compile(r"^occurrence:sha256:[0-9a-f]{64}$")


def utc_now_iso() -> str:
    """Return current UTC time as ISO 8601 string."""
    return datetime.datetime.now(datetime.UTC).isoformat()


def compute_file_sha256(path: Path | str, chunk_size: int = 65536) -> tuple[str, int]:
    """Compute SHA-256 hex digest and size in bytes for a file."""
    p = Path(path)
    if not p.is_file():
        raise FileNotFoundError(f"File not found: {p}")
    hasher = hashlib.sha256()
    size = 0
    with p.open("rb") as f:
        while chunk := f.read(chunk_size):
            hasher.update(chunk)
            size += len(chunk)
    return hasher.hexdigest(), size


def guess_mime_type(path: Path | str) -> str:
    """Guess MIME type from file extension with fallback to octet-stream."""
    mime, _ = mimetypes.guess_type(str(path))
    if mime:
        return mime
    suffix = Path(path).suffix.lower()
    mapping = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".md": "text/markdown",
        ".json": "application/json",
    }
    return mapping.get(suffix, "application/octet-stream")


@dataclass(frozen=True)
class CanonicalAssetRecord:
    """Canonical asset record conforming to contracts/asset-record-v1.schema.json."""

    asset_id: str
    content_hash: str
    storage_locator: str
    mime_type: str
    size_bytes: int
    processing_state: str = "ready"
    schema: str = "asset-record"
    schema_version: int = 1

    def __post_init__(self) -> None:
        if not ASSET_ID_RE.match(self.asset_id):
            raise ValueError(f"Invalid asset_id format: {self.asset_id}")
        if not ASSET_ID_RE.match(self.content_hash):
            raise ValueError(f"Invalid content_hash format: {self.content_hash}")
        if self.processing_state not in ("ready", "failed"):
            raise ValueError(f"Invalid processing_state: {self.processing_state}")
        if self.size_bytes < 0:
            raise ValueError(f"size_bytes must be non-negative: {self.size_bytes}")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class SourceOccurrenceRecord:
    """Source occurrence record conforming to contracts/source-occurrence-record-v1.schema.json."""

    source_occurrence_id: str
    asset_id: str
    source_id: str
    source_kind: str
    source_location: str
    original_path: str
    ingest_job_id: str
    observed_at: str
    source_archive_id: str | None = None
    source_archive_location: str | None = None
    source_member: str | None = None
    schema: str = "source-occurrence-record"
    schema_version: int = 1

    def __post_init__(self) -> None:
        if not OCCURRENCE_ID_RE.match(self.source_occurrence_id):
            raise ValueError(f"Invalid source_occurrence_id format: {self.source_occurrence_id}")
        if not ASSET_ID_RE.match(self.asset_id):
            raise ValueError(f"Invalid asset_id format: {self.asset_id}")

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class IngestSummary:
    """Summary of an ingestion run."""

    job_id: str
    source_id: str
    files_scanned: int = 0
    assets_created: int = 0
    duplicate_occurrences: int = 0
    failed_count: int = 0
    assets: list[CanonicalAssetRecord] = field(default_factory=list)
    occurrences: list[SourceOccurrenceRecord] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "job_id": self.job_id,
            "source_id": self.source_id,
            "files_scanned": self.files_scanned,
            "assets_created": self.assets_created,
            "duplicate_occurrences": self.duplicate_occurrences,
            "failed_count": self.failed_count,
            "assets_count": len(self.assets),
            "occurrences_count": len(self.occurrences),
        }


class IngestService:
    """Universal source connector and ingestion manager."""

    def __init__(
        self,
        *,
        analysis_service: Any = None,
        search_service: Any = None,
    ) -> None:
        self.analysis_service = analysis_service
        self.search_service = search_service
        self._known_assets: dict[str, CanonicalAssetRecord] = {}
        self._known_occurrences: dict[str, SourceOccurrenceRecord] = {}

    @property
    def known_assets(self) -> dict[str, CanonicalAssetRecord]:
        return self._known_assets

    @property
    def known_occurrences(self) -> dict[str, SourceOccurrenceRecord]:
        return self._known_occurrences

    def ingest_file(
        self,
        file_path: Path | str,
        source_id: str,
        source_kind: str = "local_folder",
        source_location: str | None = None,
        original_path: str | None = None,
        job_id: str | None = None,
        auto_analyse: bool = False,
    ) -> tuple[CanonicalAssetRecord, SourceOccurrenceRecord, bool]:
        """Ingest a single file.

        Returns (asset_record, occurrence_record, is_new_asset).
        """
        p = Path(file_path).resolve()
        if not p.is_file():
            raise FileNotFoundError(f"File does not exist: {p}")

        effective_job_id = job_id or f"job-{hashlib.sha256(utc_now_iso().encode()).hexdigest()[:12]}"
        effective_loc = source_location or str(p.parent)
        rel_or_orig_path = original_path or str(p)

        digest, size_bytes = compute_file_sha256(p)
        asset_id = f"sha256:{digest}"
        content_hash = f"sha256:{digest}"
        mime_type = guess_mime_type(p)

        # Occurrence ID is deterministic from source_id + original_path
        occ_seed = f"{source_id}:{rel_or_orig_path}"
        occ_hash = hashlib.sha256(occ_seed.encode("utf-8")).hexdigest()
        occurrence_id = f"occurrence:sha256:{occ_hash}"

        occurrence = SourceOccurrenceRecord(
            source_occurrence_id=occurrence_id,
            asset_id=asset_id,
            source_id=source_id,
            source_kind=source_kind,
            source_location=effective_loc,
            original_path=rel_or_orig_path,
            ingest_job_id=effective_job_id,
            observed_at=utc_now_iso(),
        )
        self._known_occurrences[occurrence_id] = occurrence

        is_new_asset = asset_id not in self._known_assets
        if is_new_asset:
            asset = CanonicalAssetRecord(
                asset_id=asset_id,
                content_hash=content_hash,
                storage_locator=str(p),
                mime_type=mime_type,
                size_bytes=size_bytes,
                processing_state="ready",
            )
            self._known_assets[asset_id] = asset
        else:
            asset = self._known_assets[asset_id]

        if auto_analyse and self.analysis_service and is_new_asset and mime_type.startswith("image/"):
            try:
                from analysis_service.models import AssetInput  # type: ignore[import-untyped]
                from search_service import visual_feature_input_from_analysis  # type: ignore[import-untyped]

                asset_input = AssetInput(asset_id, asset_id, str(p), mime_type)
                outcome = self.analysis_service.analyse(asset_input)
                if self.search_service and outcome.record.visual_features:
                    feat_in = visual_feature_input_from_analysis(
                        outcome.record.visual_features[0].to_dict()
                    )
                    self.search_service.index_visual_feature(feat_in)
            except (OSError, ValueError, TypeError, KeyError) as exc:
                logger.warning("Failed to auto-analyse asset %s: %s", asset_id, exc)

        self._sync_metadata_index(asset)
        return asset, occurrence, is_new_asset

    def _sync_metadata_index(self, asset: CanonicalAssetRecord) -> None:
        """Index or update canonical asset metadata and all its occurrences in SearchService."""
        if not self.search_service or not hasattr(self.search_service, "index_metadata"):
            return
        try:
            from search_service import (  # type: ignore[import-untyped]
                MetadataDocumentInput,
                SourceOccurrenceProvenance,
            )

            asset_occurrences = [
                SourceOccurrenceProvenance(
                    source_occurrence_id=occ.source_occurrence_id,
                    source_id=occ.source_id,
                    original_path=occ.original_path,
                    source_kind=occ.source_kind,
                    source_location=occ.source_location,
                    source_archive_id=occ.source_archive_id,
                    source_member=occ.source_member,
                )
                for occ in self._known_occurrences.values()
                if occ.asset_id == asset.asset_id
            ]
            primary_occ = asset_occurrences[0] if asset_occurrences else None
            category = (
                "Photos"
                if asset.mime_type.startswith("image/")
                else "Videos"
                if asset.mime_type.startswith("video/")
                else "Documents"
            )
            doc = MetadataDocumentInput(
                asset_id=asset.asset_id,
                content_hash=asset.content_hash,
                mime_type=asset.mime_type,
                size_bytes=asset.size_bytes,
                original_path=primary_occ.original_path if primary_occ else asset.storage_locator,
                source_kind=primary_occ.source_kind or "local_folder"
                if primary_occ
                else "local_folder",
                source_location=primary_occ.source_location or "" if primary_occ else "",
                category=category,
                tags=(category.lower(),),
                source_occurrences=tuple(asset_occurrences),
            )
            self.search_service.index_metadata(doc)
        except Exception as exc:
            logger.warning("Failed to sync metadata index for %s: %s", asset.asset_id, exc)

    def ingest_directory(
        self,
        directory_path: Path | str,
        source_id: str,
        recursive: bool = True,
        job_id: str | None = None,
        auto_analyse: bool = False,
    ) -> IngestSummary:
        """Scan and ingest all files in a directory."""
        dir_path = Path(directory_path).resolve()
        if not dir_path.is_dir():
            raise NotADirectoryError(f"Directory not found: {dir_path}")

        effective_job_id = job_id or f"job-{hashlib.sha256(utc_now_iso().encode()).hexdigest()[:12]}"
        summary = IngestSummary(job_id=effective_job_id, source_id=source_id)

        iterator = dir_path.rglob("*") if recursive else dir_path.glob("*")
        for item in sorted(iterator):
            if not item.is_file() or item.name.startswith("."):
                continue

            summary.files_scanned += 1
            rel_path = str(item.relative_to(dir_path))
            try:
                asset, occ, is_new = self.ingest_file(
                    file_path=item,
                    source_id=source_id,
                    source_kind="local_folder",
                    source_location=str(dir_path),
                    original_path=rel_path,
                    job_id=effective_job_id,
                    auto_analyse=auto_analyse,
                )
                summary.occurrences.append(occ)
                if is_new:
                    summary.assets_created += 1
                    summary.assets.append(asset)
                else:
                    summary.duplicate_occurrences += 1
            except (OSError, ValueError, TypeError, KeyError) as exc:
                logger.warning("Failed to ingest %s: %s", item, exc)
                summary.failed_count += 1

        return summary

    def import_extract_export(
        self,
        export_dir: Path | str,
        source_id: str,
        job_id: str | None = None,
    ) -> IngestSummary:
        """Import canonical records from an Extract export manifest or directory.

        Accepts either a directory containing an export manifest or json record files.
        Conforms strictly to contracts/asset-record-v1 and contracts/source-occurrence-record-v1.
        """
        export_path = Path(export_dir).resolve()
        if not export_path.is_dir():
            raise NotADirectoryError(f"Export directory not found: {export_path}")

        effective_job_id = job_id or f"extract-{hashlib.sha256(utc_now_iso().encode()).hexdigest()[:12]}"
        summary = IngestSummary(job_id=effective_job_id, source_id=source_id)

        manifest_file = export_path / "manifest.json"
        if manifest_file.is_file():
            with manifest_file.open("r", encoding="utf-8") as f:
                manifest_data = json.load(f)
            records = manifest_data.get("records", [])
            for rec in records:
                summary.files_scanned += 1
                try:
                    asset_id = rec["asset_id"]
                    content_hash = rec.get("content_hash", asset_id)
                    locator = str(export_path / rec.get("relative_path", rec.get("storage_locator", "")))
                    mime = rec.get("mime_type", "application/octet-stream")
                    size = int(rec.get("size_bytes", 0))

                    is_new = asset_id not in self._known_assets
                    asset = CanonicalAssetRecord(
                        asset_id=asset_id,
                        content_hash=content_hash,
                        storage_locator=locator,
                        mime_type=mime,
                        size_bytes=size,
                        processing_state=rec.get("processing_state", "ready"),
                    )
                    self._known_assets[asset_id] = asset

                    occ_seed = f"{source_id}:{rec.get('original_path', locator)}"
                    occ_id = f"occurrence:sha256:{hashlib.sha256(occ_seed.encode('utf-8')).hexdigest()}"
                    occ = SourceOccurrenceRecord(
                        source_occurrence_id=occ_id,
                        asset_id=asset_id,
                        source_id=source_id,
                        source_kind="extract_export",
                        source_location=str(export_path),
                        original_path=rec.get("original_path", locator),
                        ingest_job_id=effective_job_id,
                        observed_at=rec.get("observed_at", utc_now_iso()),
                        source_archive_id=rec.get("source_archive_id"),
                        source_archive_location=rec.get("source_archive_location"),
                        source_member=rec.get("source_member"),
                    )
                    self._known_occurrences[occ_id] = occ
                    summary.occurrences.append(occ)
                    self._sync_metadata_index(asset)

                    if is_new:
                        summary.assets_created += 1
                        summary.assets.append(asset)
                    else:
                        summary.duplicate_occurrences += 1
                except (OSError, ValueError, TypeError, KeyError) as exc:
                    logger.warning("Error importing record from manifest: %s", exc)
                    summary.failed_count += 1
            return summary

        # Fallback: scan for standalone json records
        for json_file in sorted(export_path.glob("*.json")):
            summary.files_scanned += 1
            try:
                with json_file.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                if data.get("schema") == "asset-record":
                    asset = CanonicalAssetRecord(
                        asset_id=data["asset_id"],
                        content_hash=data["content_hash"],
                        storage_locator=data["storage_locator"],
                        mime_type=data["mime_type"],
                        size_bytes=data["size_bytes"],
                        processing_state=data.get("processing_state", "ready"),
                    )
                    if asset.asset_id not in self._known_assets:
                        summary.assets_created += 1
                        summary.assets.append(asset)
                        self._known_assets[asset.asset_id] = asset
                    else:
                        summary.duplicate_occurrences += 1
            except (OSError, ValueError, TypeError, KeyError) as exc:
                logger.warning("Error reading %s: %s", json_file, exc)
                summary.failed_count += 1

        return summary


def main() -> None:
    parser = argparse.ArgumentParser(description="Gallery Ingestion Service CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    scan_parser = subparsers.add_parser("scan", help="Scan local folder and ingest assets")
    scan_parser.add_argument("path", help="Folder path to scan")
    scan_parser.add_argument("--source-id", default="local_collection", help="Unique identifier for source")
    scan_parser.add_argument("--no-recursive", action="store_true", help="Do not recurse subdirectories")

    import_parser = subparsers.add_parser("import-extract", help="Import Extract export records")
    import_parser.add_argument("path", help="Extract export folder path")
    import_parser.add_argument("--source-id", default="extract_export", help="Unique identifier for source")

    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)

    svc = IngestService()
    if args.command == "scan":
        summary = svc.ingest_directory(
            args.path,
            source_id=args.source_id,
            recursive=not args.no_recursive,
        )
        print(json.dumps(summary.to_dict(), indent=2))
    elif args.command == "import-extract":
        summary = svc.import_extract_export(args.path, source_id=args.source_id)
        print(json.dumps(summary.to_dict(), indent=2))


if __name__ == "__main__":
    main()
