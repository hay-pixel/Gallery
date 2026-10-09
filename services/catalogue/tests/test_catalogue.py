import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from catalogue_service.store import Catalogue


@pytest.fixture
def collection(tmp_path):
    source = tmp_path / "collection"
    source.mkdir()
    store = Catalogue(tmp_path / "state")
    yield store, source
    store.close()


def ingest(store, source, owner="alice", source_id="camera"):
    return store.import_collection(source, owner=owner, source_id=source_id)


def test_duplicates_contracts_restart_and_originals(collection):
    store, source = collection
    (source / "a.txt").write_bytes(b"same bytes")
    (source / "b.txt").write_bytes(b"same bytes")
    ingest(store, source)
    first = store.list_assets(owner="alice")
    ingest(store, source)
    assert store.list_assets(owner="alice") == first
    assert len(first["results"]) == 1
    row = first["results"][0]
    assert row["asset"]["asset_id"] == "sha256:" + hashlib.sha256(b"same bytes").hexdigest()
    assert len(row["source_occurrences"]) == 2
    assert {o["original_path"] for o in row["source_occurrences"]} == {"a.txt", "b.txt"}
    contracts = Path(__file__).resolve().parents[3] / "contracts"
    for name, records in [
        ("asset-record-v1.schema.json", [row["asset"]]),
        ("source-occurrence-record-v1.schema.json", row["source_occurrences"]),
    ]:
        validator = Draft202012Validator(json.loads((contracts / name).read_text()))
        for record in records:
            validator.validate(record)
    state = store.root
    store.close()
    restarted = Catalogue(state)
    try:
        assert restarted.list_assets(owner="alice") == first
        (source / "a.txt").unlink()
        assert Path(row["asset"]["storage_locator"]).read_bytes() == b"same bytes"
        assert (source / "b.txt").read_bytes() == b"same bytes"
    finally:
        restarted.close()


def test_changed_path_retains_both_assets(collection):
    store, source = collection
    file = source / "photo.jpg"
    file.write_bytes(b"old")
    ingest(store, source)
    old = store.list_assets(owner="alice")["results"][0]
    file.write_bytes(b"new")
    ingest(store, source)
    results = store.list_assets(owner="alice")["results"]
    assert len(results) == 2
    assert old in results
    assert Path(old["asset"]["storage_locator"]).read_bytes() == b"old"


def test_owner_and_source_provenance_isolation(collection, tmp_path):
    store, source = collection
    (source / "a.txt").write_bytes(b"same")
    ingest(store, source)
    assert store.list_assets(owner="bob")["results"] == []
    ingest(store, source, owner="bob")
    ingest(store, source, source_id="backup")
    alice = store.list_assets(owner="alice")["results"][0]
    bob = store.list_assets(owner="bob")["results"][0]
    assert alice["asset"] == bob["asset"]
    assert len(alice["source_occurrences"]) == 2
    assert len(bob["source_occurrences"]) == 1
    assert bob["source_occurrences"][0] not in alice["source_occurrences"]
    other = tmp_path / "other"
    other.mkdir()
    with pytest.raises(ValueError, match="another root"):
        ingest(store, other)


def test_pagination_and_empty_collection(collection):
    store, source = collection
    assert ingest(store, source)["files_observed"] == 0
    assert store.list_assets(owner="alice") == {"results": [], "next_cursor": None}
    for i in range(5):
        (source / str(i)).write_bytes(str(i).encode())
    ingest(store, source)
    cursor = None
    ids = []
    while True:
        page = store.list_assets(owner="alice", limit=2, cursor=cursor)
        ids.extend(row["asset"]["asset_id"] for row in page["results"])
        cursor = page["next_cursor"]
        if cursor is None:
            break
    assert len(ids) == len(set(ids)) == 5
    assert ids == sorted(ids)
    for kwargs in [{"limit": 0}, {"limit": 201}, {"cursor": "bad"}]:
        with pytest.raises(ValueError):
            store.list_assets(owner="alice", **kwargs)


def test_skip_symlinks_and_special_files(collection, tmp_path):
    store, source = collection
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "secret.txt").write_text("outside")
    (source / "link.txt").symlink_to(outside / "secret.txt")
    (source / "directory-link").symlink_to(outside, target_is_directory=True)
    os.mkfifo(source / "pipe")
    report = ingest(store, source)
    assert set(report["skipped_paths"]) == {"link.txt", "directory-link", "pipe"}
    assert report["files_observed"] == 0
    assert store.list_assets(owner="alice")["results"] == []


def test_reject_overlapping_storage(collection):
    store, _source = collection
    with pytest.raises(ValueError, match="separate trees"):
        ingest(store, store.root.parent)
    with pytest.raises(ValueError, match="separate trees"):
        ingest(store, store.blobs)


def test_collection_failure_rolls_back_metadata_and_retry_works(collection, monkeypatch):
    store, source = collection
    (source / "a").write_bytes(b"a")
    (source / "b").write_bytes(b"b")
    original_copy = store._copy

    def fail_second(path):
        if path.name == "b":
            raise OSError("unreadable")
        return original_copy(path)

    monkeypatch.setattr(store, "_copy", fail_second)
    with pytest.raises(OSError, match="unreadable"):
        ingest(store, source)
    assert store.list_assets(owner="alice")["results"] == []
    monkeypatch.setattr(store, "_copy", original_copy)
    ingest(store, source)
    assert len(store.list_assets(owner="alice")["results"]) == 2


def test_corrupt_existing_blob_fails_without_ready_record(collection):
    store, source = collection
    (source / "a").write_bytes(b"a")
    digest = hashlib.sha256(b"a").hexdigest()
    (store.blobs / digest).write_bytes(b"corrupt")
    with pytest.raises(ValueError, match="corrupt"):
        ingest(store, source)
    assert store.list_assets(owner="alice")["results"] == []
    assert not list(store.blobs.glob("tmp*"))


def test_cli_real_process_restart_and_failure(tmp_path):
    source = tmp_path / "source"
    source.mkdir()
    (source / "note.txt").write_text("real local collection")
    command = [
        sys.executable,
        "-m",
        "catalogue_service.cli",
        "--state-root",
        str(tmp_path / "state"),
        "--owner",
        "alice",
    ]
    imported = subprocess.run(
        command + ["import-local", "--source-root", str(source), "--source-id", "notes"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert imported.returncode == 0, imported.stderr
    assert json.loads(imported.stdout)["files_observed"] == 1
    listed = subprocess.run(command + ["list"], capture_output=True, text=True, check=False)
    assert listed.returncode == 0, listed.stderr
    row = json.loads(listed.stdout)["results"][0]
    assert Path(row["asset"]["storage_locator"]).read_text() == "real local collection"
    failed = subprocess.run(
        command + ["list", "--limit", "0"], capture_output=True, text=True, check=False
    )
    assert failed.returncode == 1
    assert failed.stdout == ""
