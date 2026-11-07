"""Grounded reasoning engine and citation verification.

Conforms strictly to docs/contracts/OLLAMA.md:
- Never invents asset IDs or citations.
- Validates that every supporting asset was returned by an authorized tool.
- Preserves exact analysis_result_id and analysis_id provenance.
- Provides truthful fallback when Ollama is offline or no supporting assets exist.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Sequence

from .client import OllamaClient
from .models import (
    AssetContext,
    GroundedAnswer,
    SupportingAsset,
    WebContext,
)

logger = logging.getLogger("gallery.ollama.grounding")


SYSTEM_GROUNDING_PROMPT = """You are the private AI reasoning assistant for the Gallery archive.
Your task is to answer the user's question ONLY using the verified canonical assets provided in the context below.

STRICT CONSTRAINTS:
1. Never invent or hallucinate asset IDs, filenames, or metadata.
2. Only cite assets that are listed in the PROVIDED ASSETS list.
3. For each claim, cite the relevant asset_id.
4. If the provided assets do not contain enough evidence to answer, state this clearly in your limitations.
5. Provide your response as a JSON object matching this schema:
{
  "answer": "Clear, grounded answer to the question.",
  "cited_asset_ids": ["sha256:..."],
  "limitations": ["Any limitation, missing OCR, or partial context."]
}
"""


class GroundingEngine:
    """Orchestrates Ollama reasoning over grounded asset evidence."""

    def __init__(
        self,
        client: OllamaClient | None = None,
        model_name: str = "llama3.2:3b",
    ) -> None:
        self.client = client
        self.model_name = model_name

    def synthesize(
        self,
        question: str,
        retrieved_assets: Sequence[AssetContext],
        *,
        optional_web_context: Sequence[WebContext] | None = None,
    ) -> GroundedAnswer:
        """Synthesize a grounded answer using retrieved canonical asset context."""
        # Check for empty retrieved context
        if not retrieved_assets:
            return GroundedAnswer(
                answer="I couldn’t find any supporting catalogue records for that question in the archive.",
                supporting_assets=(),
                limitations=("No matching assets found in local catalogue or search index.",),
                web_context=tuple(optional_web_context or ()),
            )

        # Index available candidate assets by asset_id to enforce anti-hallucination
        candidate_map = {asset.asset_id: asset for asset in retrieved_assets}
        limitations: list[str] = []

        # If Ollama client is not available or offline, use deterministic fallback
        if self.client is None or not self._is_client_available():
            return self._deterministic_fallback(
                question,
                retrieved_assets,
                reason="Ollama runtime is offline; deterministic evidence summary provided.",
                web_context=optional_web_context,
            )

        # Build context for Ollama
        asset_summaries = []
        for a in retrieved_assets[:15]:  # Bound context window
            matched = [f"tag:{t}" for t in a.tags]
            if a.ocr_text:
                matched.append(f"ocr:{a.ocr_text[:100]}")
            asset_summaries.append({
                "asset_id": a.asset_id,
                "filename": a.original_path,
                "category": a.category,
                "subcategory": a.subcategory,
                "tags": list(a.tags),
                "summary": a.summary,
                "ocr_snippet": a.ocr_text[:200] if a.ocr_text else None,
            })

        user_content = json.dumps({
            "question": question,
            "provided_assets": asset_summaries,
        })

        messages = [
            {"role": "system", "content": SYSTEM_GROUNDING_PROMPT},
            {"role": "user", "content": user_content},
        ]

        try:
            resp = self.client.chat(self.model_name, messages, format_json=True)
            msg_content = resp.get("message", {}).get("content", "")
            parsed = json.loads(msg_content)
            raw_answer = str(parsed.get("answer", "")).strip()
            raw_cited_ids = parsed.get("cited_asset_ids", [])
            raw_limitations = parsed.get("limitations", [])

            if isinstance(raw_limitations, list):
                limitations.extend(str(x) for x in raw_limitations)

            # Strict Hallucination Filter: only keep cited IDs that exist in candidate_map
            verified_supporting: list[SupportingAsset] = []
            for cited_id in raw_cited_ids:
                if cited_id in candidate_map:
                    candidate = candidate_map[cited_id]
                    matched_meta = [f"tag:{t}" for t in candidate.tags]
                    if candidate.ocr_text:
                        matched_meta.append(f"ocr:{candidate.ocr_text[:60]}")
                    verified_supporting.append(
                        SupportingAsset(
                            asset_id=candidate.asset_id,
                            relationship="evidence",
                            matched_metadata=tuple(matched_meta),
                            analysis_id=candidate.analysis_id,
                            analysis_result_id=candidate.analysis_result_id,
                            evidence_source=candidate.evidence_source,
                            source_occurrences=candidate.source_occurrences,
                            confidence=0.9,
                        )
                    )
                else:
                    logger.warning("Filtered out hallucinated asset ID: %s", cited_id)

            # If model cited nothing or valid citations were empty, include the top matching asset
            if not verified_supporting and retrieved_assets:
                top = retrieved_assets[0]
                verified_supporting.append(
                    SupportingAsset(
                        asset_id=top.asset_id,
                        relationship="evidence",
                        matched_metadata=tuple(f"tag:{t}" for t in top.tags),
                        analysis_id=top.analysis_id,
                        analysis_result_id=top.analysis_result_id,
                        evidence_source=top.evidence_source,
                        source_occurrences=top.source_occurrences,
                        confidence=0.7,
                    )
                )

            return GroundedAnswer(
                answer=raw_answer or "Here are the supporting archive records matching your question.",
                supporting_assets=tuple(verified_supporting),
                limitations=tuple(limitations),
                web_context=tuple(optional_web_context or ()),
            )

        except (RuntimeError, ValueError, KeyError, json.JSONDecodeError, OSError) as exc:
            logger.warning("Ollama grounded reasoning call failed: %s; falling back", exc)
            return self._deterministic_fallback(
                question,
                retrieved_assets,
                reason=f"Ollama reasoning error ({exc.__class__.__name__}); fell back to deterministic summary.",
                web_context=optional_web_context,
            )

    def _is_client_available(self) -> bool:
        if self.client is None:
            return False
        health = self.client.health()
        return health.reachable

    def _deterministic_fallback(
        self,
        question: str,
        retrieved_assets: Sequence[AssetContext],
        reason: str,
        web_context: Sequence[WebContext] | None = None,
    ) -> GroundedAnswer:
        """Deterministic fallback when Ollama is unavailable, ensuring contract compliance."""
        count = len(retrieved_assets)
        top = retrieved_assets[:3]
        summary_items = [f"{a.original_path or a.asset_id[:16]} ({a.category})" for a in top]
        answer = (
            f"Found {count} grounded catalogue {'record' if count == 1 else 'records'}: "
            f"{'; '.join(summary_items)}. "
            f"Results are retrieved directly from verified catalogue metadata and analysis records."
        )

        supporting = [
            SupportingAsset(
                asset_id=a.asset_id,
                relationship="evidence",
                matched_metadata=tuple(f"tag:{t}" for t in a.tags),
                analysis_id=a.analysis_id,
                analysis_result_id=a.analysis_result_id,
                evidence_source=a.evidence_source,
                source_occurrences=a.source_occurrences,
                confidence=0.8,
            )
            for a in retrieved_assets[:5]
        ]

        return GroundedAnswer(
            answer=answer,
            supporting_assets=tuple(supporting),
            limitations=(reason,),
            web_context=tuple(web_context or ()),
        )
