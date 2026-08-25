"""SQLite persistence for rebuildable visual feature indexes.

The database holds derived Search state only. Canonical asset and analysis records remain
upstream sources of truth and can be used to rebuild these rows after corruption.
"""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from threading import RLock

import numpy as np

from .models import (
    AssetSearchState,
    ContractError,
    FeatureProfile,
    IndexState,
    IndexStatus,
    IndexUnavailableError,
    VisualFeatureInput,
    utc_now,
)

SCHEMA_VERSION = 2


@dataclass(frozen=True)
class StoredVector:
    """Internal persisted vector row. It is never returned as a Search result."""

    asset_id: str
    content_hash: str
    feature_id: str
    analysis_id: str | None
    analysis_result_id: str | None
    vector_blob: bytes
    vector_norm: float


class VisualIndexStore:
    """Durable, single-host vector state with SQLite transactional updates."""

    def __init__(self, database_path: str | Path) -> None:
        self.database_path = Path(database_path).expanduser().resolve()
        self._lock = RLock()
        try:
            self.database_path.parent.mkdir(parents=True, exist_ok=True)
            self._connection = sqlite3.connect(
                self.database_path, check_same_thread=False, isolation_level=None
            )
            self._connection.row_factory = sqlite3.Row
            self._connection.execute("PRAGMA foreign_keys = ON")
            self._connection.execute("PRAGMA journal_mode = WAL")
            self._connection.execute("PRAGMA synchronous = FULL")
            self._initialise()
        except (OSError, sqlite3.DatabaseError) as error:
            raise IndexUnavailableError(
                f"visual index database is unavailable or corrupt at {self.database_path}; "
                "restore a known-good copy or rebuild from canonical analysis outputs"
            ) from error

    def close(self) -> None:
        with self._lock:
            self._connection.close()

    def _initialise(self) -> None:
        # sqlite3.executescript() manages its own statement boundary. Avoid wrapping
        # schema DDL in transaction(), which would otherwise attempt a second COMMIT.
        with self._lock:
            connection = self._connection
            current_version = int(connection.execute("PRAGMA user_version").fetchone()[0])
            if current_version > SCHEMA_VERSION:
                raise IndexUnavailableError(
                    f"visual index schema {current_version} is newer than supported {SCHEMA_VERSION}"
                )
            if current_version == 1:
                connection.executescript("DROP TABLE IF EXISTS vectors; DROP TABLE IF EXISTS profiles;")
                current_version = 0
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS profiles (
                    partition_key TEXT PRIMARY KEY,
                    feature_type TEXT NOT NULL,
                    feature_model_id TEXT NOT NULL,
                    feature_model_version TEXT NOT NULL,
                    feature_extractor_revision TEXT NOT NULL,
                    dimensions INTEGER NOT NULL CHECK (dimensions > 0),
                    similarity_family TEXT NOT NULL CHECK (similarity_family = 'cosine'),
                    normalization_json TEXT NOT NULL,
                    revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
                    updated_at TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS vectors (
                    partition_key TEXT NOT NULL,
                    asset_id TEXT NOT NULL,
                    content_hash TEXT NOT NULL,
                    feature_id TEXT NOT NULL,
                    analysis_id TEXT,
                    analysis_result_id TEXT,
                    generated_at TEXT NOT NULL,
                    indexed_at TEXT NOT NULL,
                    vector_blob BLOB NOT NULL,
                    vector_norm REAL NOT NULL CHECK (vector_norm > 0),
                    stale INTEGER NOT NULL DEFAULT 0 CHECK (stale IN (0, 1)),
                    stale_reason TEXT,
                    PRIMARY KEY (partition_key, asset_id),
                    FOREIGN KEY (partition_key) REFERENCES profiles(partition_key) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS vectors_active_profile
                    ON vectors(partition_key, stale, asset_id);
                """
            )
            if current_version == 0:
                connection.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        with self._lock:
            try:
                self._connection.execute("BEGIN IMMEDIATE")
                yield self._connection
            except Exception:
                self._connection.execute("ROLLBACK")
                raise
            else:
                self._connection.execute("COMMIT")

    @staticmethod
    def _profile_from_row(row: sqlite3.Row) -> FeatureProfile:
        if str(row["similarity_family"]) != "cosine":
            raise IndexUnavailableError("stored visual index uses an unsupported similarity family")
        return FeatureProfile(
            feature_type=str(row["feature_type"]),
            feature_model_id=str(row["feature_model_id"]),
            feature_model_version=str(row["feature_model_version"]),
            feature_extractor_revision=str(row["feature_extractor_revision"]),
            dimensions=int(row["dimensions"]),
            similarity_family="cosine",
            normalization=json.loads(str(row["normalization_json"])),
        )

    @staticmethod
    def _vector_blob(values: Sequence[float], dimension: int) -> tuple[bytes, float]:
        vector = np.asarray(values, dtype=np.float32)
        if vector.ndim != 1 or vector.size != dimension:
            raise ContractError("vector dimensions do not match the feature profile")
        norm = float(np.linalg.norm(vector))
        if not np.isfinite(norm) or norm <= 0:
            raise ContractError("vector norm must be finite and positive")
        return vector.tobytes(), norm

    def _ensure_profile(self, connection: sqlite3.Connection, profile: FeatureProfile) -> None:
        row = connection.execute(
            "SELECT * FROM profiles WHERE partition_key = ?", (profile.partition_key,)
        ).fetchone()
        if row is None:
            now = utc_now()
            connection.execute(
                """
                INSERT INTO profiles (
                    partition_key, feature_type, feature_model_id, feature_model_version,
                    feature_extractor_revision, dimensions, similarity_family,
                    normalization_json, revision, updated_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
                """,
                (
                    profile.partition_key,
                    profile.feature_type,
                    profile.feature_model_id,
                    profile.feature_model_version,
                    profile.feature_extractor_revision,
                    profile.dimensions,
                    profile.similarity_family,
                    json.dumps(profile.normalization, sort_keys=True, separators=(",", ":")),
                    now,
                    now,
                ),
            )
            return
        if self._profile_from_row(row) != profile:
            raise ContractError("feature profile partition collision")

    @staticmethod
    def _touch_profile(connection: sqlite3.Connection, profile: FeatureProfile) -> None:
        connection.execute(
            """
            UPDATE profiles
            SET revision = revision + 1, updated_at = ?
            WHERE partition_key = ?
            """,
            (utc_now(), profile.partition_key),
        )

    def upsert(self, feature: VisualFeatureInput) -> bool:
        """Idempotently store one vector; return whether derived index state changed."""
        vector_blob, vector_norm = self._vector_blob(feature.values, feature.profile.dimension)
        with self.transaction() as connection:
            self._ensure_profile(connection, feature.profile)
            existing = connection.execute(
                "SELECT * FROM vectors WHERE partition_key = ? AND asset_id = ?",
                (feature.profile.partition_key, feature.asset_id),
            ).fetchone()
            if existing is not None:
                same = (
                    bytes(existing["vector_blob"]) == vector_blob
                    and str(existing["content_hash"]) == feature.content_hash
                    and str(existing["feature_id"]) == feature.stable_feature_id
                    and existing["analysis_id"] == feature.analysis_id
                    and existing["analysis_result_id"] == feature.analysis_result_id
                    and int(existing["stale"]) == 0
                )
                if same:
                    return False
            now = utc_now()
            connection.execute(
                """
                INSERT INTO vectors (
                    partition_key, asset_id, content_hash, feature_id, analysis_id,
                    analysis_result_id, generated_at, indexed_at, vector_blob, vector_norm,
                    stale, stale_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
                ON CONFLICT(partition_key, asset_id) DO UPDATE SET
                    content_hash = excluded.content_hash,
                    feature_id = excluded.feature_id,
                    analysis_id = excluded.analysis_id,
                    analysis_result_id = excluded.analysis_result_id,
                    generated_at = excluded.generated_at,
                    indexed_at = excluded.indexed_at,
                    vector_blob = excluded.vector_blob,
                    vector_norm = excluded.vector_norm,
                    stale = 0,
                    stale_reason = NULL
                """,
                (
                    feature.profile.partition_key,
                    feature.asset_id,
                    feature.content_hash,
                    feature.stable_feature_id,
                    feature.analysis_id,
                    feature.analysis_result_id,
                    feature.generated_at,
                    now,
                    vector_blob,
                    vector_norm,
                ),
            )
            self._touch_profile(connection, feature.profile)
            return True

    def remove_asset(self, asset_id: str, profile: FeatureProfile | None = None) -> int:
        """Remove derived vectors for an asset, optionally from one profile partition."""
        with self.transaction() as connection:
            if profile is None:
                rows = connection.execute(
                    "SELECT DISTINCT partition_key FROM vectors WHERE asset_id = ?", (asset_id,)
                ).fetchall()
                removed = connection.execute("DELETE FROM vectors WHERE asset_id = ?", (asset_id,)).rowcount
                for row in rows:
                    stored_profile = connection.execute(
                        "SELECT * FROM profiles WHERE partition_key = ?", (row["partition_key"],)
                    ).fetchone()
                    if stored_profile is not None:
                        self._touch_profile(connection, self._profile_from_row(stored_profile))
                return int(removed)
            removed = connection.execute(
                "DELETE FROM vectors WHERE partition_key = ? AND asset_id = ?",
                (profile.partition_key, asset_id),
            ).rowcount
            if removed:
                self._touch_profile(connection, profile)
            return int(removed)

    def invalidate_asset(self, asset_id: str, profile: FeatureProfile, reason: str) -> bool:
        """Mark a vector stale without deleting evidence of its required reindex."""
        if not reason.strip():
            raise ContractError("stale reason must not be empty")
        with self.transaction() as connection:
            updated = connection.execute(
                """
                UPDATE vectors
                SET stale = 1, stale_reason = ?
                WHERE partition_key = ? AND asset_id = ? AND stale = 0
                """,
                (reason, profile.partition_key, asset_id),
            ).rowcount
            if updated:
                self._touch_profile(connection, profile)
            return bool(updated)

    def get_asset_state(self, asset_id: str, profile: FeatureProfile) -> AssetSearchState:
        with self._lock:
            try:
                row = self._connection.execute(
                    """
                    SELECT stale, stale_reason, indexed_at
                    FROM vectors WHERE partition_key = ? AND asset_id = ?
                    """,
                    (profile.partition_key, asset_id),
                ).fetchone()
            except sqlite3.DatabaseError as error:
                raise IndexUnavailableError("visual index is unavailable") from error
        if row is None:
            return AssetSearchState(asset_id=asset_id, profile=profile, state="missing")
        if int(row["stale"]):
            return AssetSearchState(
                asset_id=asset_id,
                profile=profile,
                state="stale",
                stale_reason=str(row["stale_reason"]),
                indexed_at=str(row["indexed_at"]),
            )
        return AssetSearchState(
            asset_id=asset_id,
            profile=profile,
            state="indexed",
            indexed_at=str(row["indexed_at"]),
        )

    def active_vectors(self, profile: FeatureProfile) -> list[StoredVector]:
        with self._lock:
            try:
                rows = self._connection.execute(
                    """
                    SELECT asset_id, content_hash, feature_id, analysis_id, analysis_result_id,
                           vector_blob, vector_norm
                    FROM vectors WHERE partition_key = ? AND stale = 0 ORDER BY asset_id
                    """,
                    (profile.partition_key,),
                ).fetchall()
            except sqlite3.DatabaseError as error:
                raise IndexUnavailableError("visual index is unavailable") from error
        return [
            StoredVector(
                asset_id=str(row["asset_id"]),
                content_hash=str(row["content_hash"]),
                feature_id=str(row["feature_id"]),
                analysis_id=str(row["analysis_id"]) if row["analysis_id"] is not None else None,
                analysis_result_id=str(row["analysis_result_id"])
                if row["analysis_result_id"] is not None
                else None,
                vector_blob=bytes(row["vector_blob"]),
                vector_norm=float(row["vector_norm"]),
            )
            for row in rows
        ]

    def get_status(self, profile: FeatureProfile) -> IndexStatus:
        with self._lock:
            try:
                profile_row = self._connection.execute(
                    "SELECT * FROM profiles WHERE partition_key = ?", (profile.partition_key,)
                ).fetchone()
                if profile_row is None:
                    raise IndexUnavailableError(
                        f"no visual index exists for profile {profile.index_id}"
                    )
                counts = self._connection.execute(
                    """
                    SELECT
                        SUM(CASE WHEN stale = 0 THEN 1 ELSE 0 END) AS active_count,
                        SUM(CASE WHEN stale = 1 THEN 1 ELSE 0 END) AS stale_count
                    FROM vectors WHERE partition_key = ?
                    """,
                    (profile.partition_key,),
                ).fetchone()
            except sqlite3.DatabaseError as error:
                raise IndexUnavailableError("visual index is unavailable") from error
        active_count = int(counts["active_count"] or 0)
        stale_count = int(counts["stale_count"] or 0)
        state: IndexState
        if stale_count:
            state = "degraded"
            detail = f"{stale_count} stale vector(s) require reindexing"
        elif active_count:
            state = "ready"
            detail = None
        else:
            state = "empty"
            detail = None
        return IndexStatus(
            profile=profile,
            state=state,
            active_vector_count=active_count,
            stale_vector_count=stale_count,
            index_version=f"v{int(profile_row['revision'])}",
            updated_at=str(profile_row["updated_at"]),
            storage_path=str(self.database_path),
            detail=detail,
        )

    def list_profiles(self) -> list[FeatureProfile]:
        with self._lock:
            rows = self._connection.execute("SELECT * FROM profiles ORDER BY created_at").fetchall()
        return [self._profile_from_row(row) for row in rows]

    def rebuild_integrity(self, profile: FeatureProfile) -> IndexStatus:
        """Validate persisted vectors and mark malformed rows stale instead of crashing queries."""
        with self.transaction() as connection:
            self._ensure_profile(connection, profile)
            rows = connection.execute(
                """
                SELECT asset_id, vector_blob, vector_norm, stale
                FROM vectors WHERE partition_key = ?
                """,
                (profile.partition_key,),
            ).fetchall()
            stale_count = 0
            for row in rows:
                try:
                    vector = np.frombuffer(bytes(row["vector_blob"]), dtype=np.float32)
                    valid = (
                        vector.ndim == 1
                        and vector.size == profile.dimension
                        and bool(np.isfinite(vector).all())
                        and float(np.linalg.norm(vector)) > 0
                    )
                except (TypeError, ValueError):
                    valid = False
                if not valid and not int(row["stale"]):
                    connection.execute(
                        """
                        UPDATE vectors SET stale = 1, stale_reason = ?
                        WHERE partition_key = ? AND asset_id = ?
                        """,
                        ("corrupt_or_incompatible_vector", profile.partition_key, row["asset_id"]),
                    )
                    stale_count += 1
            if stale_count:
                self._touch_profile(connection, profile)
        return self.get_status(profile)

    def replace_profile(self, profile: FeatureProfile, features: Sequence[VisualFeatureInput]) -> IndexStatus:
        """Replace one derived profile from authorised analysis outputs during a full reindex."""
        for feature in features:
            if feature.profile != profile:
                raise ContractError("all replacement features must use the requested profile")
        with self.transaction() as connection:
            self._ensure_profile(connection, profile)
            connection.execute("DELETE FROM vectors WHERE partition_key = ?", (profile.partition_key,))
            now = utc_now()
            for feature in features:
                vector_blob, vector_norm = self._vector_blob(feature.values, profile.dimension)
                connection.execute(
                    """
                    INSERT INTO vectors (
                        partition_key, asset_id, content_hash, feature_id, analysis_id,
                        analysis_result_id, generated_at, indexed_at, vector_blob, vector_norm,
                        stale, stale_reason
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
                    """,
                    (
                        profile.partition_key,
                        feature.asset_id,
                        feature.content_hash,
                        feature.stable_feature_id,
                        feature.analysis_id,
                        feature.analysis_result_id,
                        feature.generated_at,
                        now,
                        vector_blob,
                        vector_norm,
                    ),
                )
            self._touch_profile(connection, profile)
        return self.get_status(profile)
