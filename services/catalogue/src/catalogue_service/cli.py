"""Trusted local operator CLI; never expose owner selection directly over HTTP."""

import argparse
import json
import sqlite3
import sys
from pathlib import Path

from .store import Catalogue


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--state-root", required=True, type=Path)
    parser.add_argument("--owner", required=True)
    commands = parser.add_subparsers(dest="command", required=True)
    ingest = commands.add_parser("import-local")
    ingest.add_argument("--source-root", required=True, type=Path)
    ingest.add_argument("--source-id", required=True)
    browse = commands.add_parser("list")
    browse.add_argument("--limit", type=int, default=50)
    browse.add_argument("--cursor")
    args = parser.parse_args()
    catalogue = None
    try:
        catalogue = Catalogue(args.state_root)
        if args.command == "import-local":
            result = catalogue.import_collection(
                args.source_root, owner=args.owner, source_id=args.source_id
            )
        else:
            result = catalogue.list_assets(owner=args.owner, limit=args.limit, cursor=args.cursor)
        print(json.dumps(result))
        return 0
    except (OSError, ValueError, sqlite3.Error) as error:
        print(f"Catalogue operation failed: {error}", file=sys.stderr)
        return 1
    finally:
        if catalogue is not None:
            catalogue.close()


if __name__ == "__main__":
    raise SystemExit(main())
