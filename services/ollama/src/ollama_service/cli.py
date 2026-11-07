"""CLI entrypoint for ollama_service inspection and testing."""

from __future__ import annotations

import argparse
import json

from .service import OllamaService


def main() -> None:
    parser = argparse.ArgumentParser(description="Gallery private Ollama service CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("health", help="Check Ollama runtime health")
    subparsers.add_parser("models", help="List installed Ollama models")

    interpret_p = subparsers.add_parser("interpret", help="Interpret a query into a query plan")
    interpret_p.add_argument("query", help="Natural language query string")

    args = parser.parse_args()
    service = OllamaService()

    if args.command == "health":
        print(json.dumps(service.health().to_dict(), indent=2))
    elif args.command == "models":
        print(json.dumps([m.to_dict() for m in service.models()], indent=2))
    elif args.command == "interpret":
        plan = service.interpret_query(args.query)
        print(json.dumps(plan.to_dict(), indent=2))


if __name__ == "__main__":
    main()
