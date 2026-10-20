"""Hybrid analysis: local rules first, then (optionally) an LLM, then a transparent blend."""
from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field

from . import heuristics
from .ai_client import AIError, get_client

logger = logging.getLogger(__name__)

W_OFFLINE, W_AI = 0.35, 0.65


@dataclass
class AnalysisOutcome:
    analysis_id: str
    offline_score: int
    ai_score: int | None
    final_score: int
    verdict: str
    provider: str
    summary: str
    reasons: list[str]
    categories: list[str]
    hits: list[dict] = field(default_factory=list)
    latency_ms: int = 0

    def to_dict(self) -> dict:
        return self.__dict__.copy()


def blend(offline: int, ai: int | None) -> int:
    """Combine both scores.

    * Weighted average (35% rules / 65% AI).
    * If the AI is very sure (>=80) it may pull the score up to ai-10 (covers languages/patterns the rules miss).
    * If the rules scream "danger" the AI can lower the result but never below 60 (caution-high).
    """
    if ai is None:
        return offline
    score = round(W_OFFLINE * offline + W_AI * ai)
    if ai >= 80:
        score = max(score, ai - 10)
    _, danger = heuristics.thresholds()
    if offline >= danger:
        score = max(score, 60)
    return max(0, min(100, score))


def analyze_message(sender: str, body: str, locale: str = "") -> AnalysisOutcome:
    started = time.monotonic()
    local = heuristics.analyze(body)
    hit_labels = [h.label for h in local.hits if h.weight > 0]
    categories = sorted({h.category for h in local.hits if h.weight > 0})

    ai_score: int | None = None
    provider = "heuristics"
    summary = ""
    reasons: list[str] = []

    client = get_client()
    if client is not None:
        try:
            ai = client.analyze(sender, body, hit_labels)
            ai_score, provider, summary, reasons = ai.score, client.name, ai.summary, ai.reasons
            if ai.category != "legitimate":
                categories = sorted(set(categories) | {ai.category})
        except AIError as exc:
            logger.warning("AI unavailable, falling back to rules: %s", exc)
            provider = "heuristics-fallback"

    final = blend(local.score, ai_score)
    verdict = heuristics.verdict_for(final)
    if not summary:
        summary = {
            "danger": "Several scam signals found. Do not click links or reply.",
            "caution": "Some warning signs. Verify the sender through an official channel.",
            "safe": "No significant scam signals found.",
        }[verdict]
    if not reasons:
        reasons = hit_labels[:4]

    return AnalysisOutcome(
        analysis_id=str(uuid.uuid4()),
        offline_score=local.score,
        ai_score=ai_score,
        final_score=final,
        verdict=verdict,
        provider=provider,
        summary=summary,
        reasons=reasons,
        categories=categories,
        hits=local.hits_as_dicts(),
        latency_ms=int((time.monotonic() - started) * 1000),
    )
