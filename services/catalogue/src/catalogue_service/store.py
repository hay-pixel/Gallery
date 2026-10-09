"""Local collection ingestion into immutable blobs and an owner-scoped SQLite catalogue.

Only trusted local operators may call this boundary. Owner IDs are scope selectors, not
credentials; a future HTTP adapter must derive them from authenticated Gallery sessions.
"""

from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import re
import sqlite3
import stat
import tempfile
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


class Catalogue:
    def __init__(self, state_root: Path):
        self.root = state_root.resolve()
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.blobs = self.root / "blobs"
        self.blobs.mkdir(exist_ok=True, mode=0o700)
        self.db = sqlite3.connect(self.root / "catalogue.sqlite")
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript("""
            CREATE TABLE IF NOT EXISTS sources (
                owner TEXT NOT NULL, source_id TEXT NOT NULL, root TEXT NOT NULL,
                PRIMARY KEY (owner, source_id)
            );
            CREATE TABLE IF NOT EXISTS assets (
                asset_id TEXT PRIMARY KEY, record TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS occurrences (
                occurrence_id TEXT PRIMARY KEY, owner TEXT NOT NULL,
                source_id TEXT NOT NULL, asset_id TEXT NOT NULL, record TEXT NOT NULL,
                FOREIGN KEY (owner, source_id) REFERENCES sources(owner, source_id),
                FOREIGN KEY (asset_id) REFERENCES assets(asset_id)
            );
            CREATE INDEX IF NOT EXISTS occurrences_owner_asset ON occurrences(owner, asset_id);
        """)

    def close(self) -> None:
        self.db.close()

    def _copy(self, path: Path) -> tuple[str, Path, int]:
        # Do not follow a final symlink or block on a FIFO substituted during discovery.
        fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        temporary: Path | None = None
        try:
            with os.fdopen(fd, "rb") as source:
                before = os.fstat(source.fileno())
                if not stat.S_ISREG(before.st_mode):
                    raise ValueError("Only regular files may be imported")
                digest = hashlib.sha256()
                size = 0
                with tempfile.NamedTemporaryFile(dir=self.blobs, delete=False) as output:
                    temporary = Path(output.name)
                    while chunk := source.read(1024 * 1024):
                        output.write(chunk)
                        digest.update(chunk)
                        size += len(chunk)
                    output.flush()
                    os.fsync(output.fileno())
                after = os.fstat(source.fileno())
                if (before.st_size, before.st_mtime_ns, before.st_ctime_ns) != (
                    after.st_size,
                    after.st_mtime_ns,
                    after.st_ctime_ns,
                ) or size != after.st_size:
                    raise ValueError("Source changed during import; retry when stable")
            content_hash = "sha256:" + digest.hexdigest()
            destination = self.blobs / digest.hexdigest()
            try:
                # Atomic create without replacing an existing canonical blob.
                os.link(temporary, destination)
                directory_fd = os.open(self.blobs, os.O_RDONLY | os.O_DIRECTORY)
                try:
                    os.fsync(directory_fd)
                finally:
                    os.close(directory_fd)
            except FileExistsError:
                with destination.open("rb") as existing:
                    if hashlib.file_digest(existing, "sha256").hexdigest() != digest.hexdigest():
                        raise ValueError("Canonical blob is corrupt; restore it before import")
            return content_hash, destination, size
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)

    def import_collection(self, source_root: Path, *, owner: str, source_id: str) -> dict[str, Any]:
        if not owner.strip() or not source_id.strip():
            raise ValueError("Owner and source ID must be non-empty")
        root = source_root.resolve(strict=True)
        if not root.is_dir():
            raise ValueError("Source must be a directory")
        if self.root.is_relative_to(root) or root.is_relative_to(self.root):
            raise ValueError("Source and catalogue storage must be separate trees")
        job = "ingest:" + str(uuid.uuid4())
        observed = datetime.now(UTC).isoformat()
        files = 0
        skipped: list[str] = []
        # Metadata is atomic per collection. On failure, unreferenced blobs may remain;
        # they are never reported as ready assets and can be reused on retry.
        with self.db:
            existing = self.db.execute(
                "SELECT root FROM sources WHERE owner=? AND source_id=?", (owner, source_id)
            ).fetchone()
            if existing and existing[0] != str(root):
                raise ValueError("Source ID is already bound to another root")
            self.db.execute(
                "INSERT OR IGNORE INTO sources VALUES (?, ?, ?)", (owner, source_id, str(root))
            )

            def walk_error(error: OSError) -> None:
                raise error

            for directory, directories, names in os.walk(
                root, followlinks=False, onerror=walk_error
            ):
                directories.sort()
                for name in list(directories):
                    path = Path(directory) / name
                    if path.is_symlink():
                        skipped.append(path.relative_to(root).as_posix())
                        directories.remove(name)
                for name in sorted(names):
                    path = Path(directory) / name
                    relative = path.relative_to(root).as_posix()
                    if not stat.S_ISREG(path.lstat().st_mode):
                        skipped.append(relative)
                        continue
                    asset_id, locator, size = self._copy(path)
                    asset = {
                        "schema": "asset-record",
                        "schema_version": 1,
                        "asset_id": asset_id,
                        "content_hash": asset_id,
                        "storage_locator": str(locator),
                        "size_bytes": size,
                        "mime_type": mimetypes.guess_type(name)[0] or "application/octet-stream",
                        "processing_state": "ready",
                    }
                    key = json.dumps([owner, source_id, relative, asset_id], ensure_ascii=False)
                    occurrence_id = "occurrence:sha256:" + hashlib.sha256(key.encode()).hexdigest()
                    occurrence = {
                        "schema": "source-occurrence-record",
                        "schema_version": 1,
                        "source_occurrence_id": occurrence_id,
                        "asset_id": asset_id,
                        "source_id": source_id,
                        "source_kind": "local_file",
                        "source_location": str(root),
                        "original_path": relative,
                        "ingest_job_id": job,
                        "observed_at": observed,
                    }
                    self.db.execute(
                        "INSERT OR IGNORE INTO assets VALUES (?, ?)", (asset_id, json.dumps(asset))
                    )
                    self.db.execute(
                        "INSERT OR IGNORE INTO occurrences VALUES (?, ?, ?, ?, ?)",
                        (occurrence_id, owner, source_id, asset_id, json.dumps(occurrence)),
                    )
                    files += 1
        return {"ingest_job_id": job, "files_observed": files, "skipped_paths": skipped}

    def list_assets(
        self, *, owner: str, limit: int = 50, cursor: str | None = None
    ) -> dict[str, Any]:
        if not owner.strip() or isinstance(limit, bool) or not 1 <= limit <= 200:
            raise ValueError("Non-empty owner and limit between 1 and 200 required")
        if cursor is not None and not re.fullmatch(r"sha256:[0-9a-f]{64}", cursor):
            raise ValueError("Invalid catalogue cursor")
        rows = self.db.execute(
            """
            SELECT a.asset_id, a.record FROM assets a
            WHERE a.asset_id > ? AND EXISTS (
                SELECT 1 FROM occurrences o WHERE o.asset_id=a.asset_id AND o.owner=?
            ) ORDER BY a.asset_id LIMIT ?
        """,
            (cursor or "", owner, limit + 1),
        ).fetchall()
        results = []
        for asset_id, record in rows[:limit]:
            occurrences = self.db.execute(
                """
                SELECT record FROM occurrences WHERE owner=? AND asset_id=?
                ORDER BY occurrence_id
            """,
                (owner, asset_id),
            ).fetchall()
            results.append(
                {
                    "asset": json.loads(record),
                    "source_occurrences": [json.loads(item[0]) for item in occurrences],
                }
            )
        return {
            "results": results,
            "next_cursor": rows[limit - 1][0] if len(rows) > limit else None,
        }
