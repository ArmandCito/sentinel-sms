"""Offline rule engine (server side). Uses the SAME rules.json as the phone."""
from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "rules.json"


@dataclass(frozen=True)
class RuleHit:
    id: str
    label: str
    category: str
    weight: int


@dataclass(frozen=True)
class HeuristicResult:
    score: int
    hits: list[RuleHit]

    def hits_as_dicts(self) -> list[dict]:
        return [asdict(h) for h in self.hits]


@dataclass(frozen=True)
class _Compiled:
    hit: RuleHit
    pattern: re.Pattern[str]


@lru_cache(maxsize=1)
def _load() -> tuple[int, int, tuple[_Compiled, ...]]:
    """Returns (caution_threshold, danger_threshold, compiled_rules)."""
    raw = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    compiled: list[_Compiled] = []
    for rule in raw["rules"]:
        flags = re.IGNORECASE if "i" in rule.get("flags", "") else 0
        compiled.append(
            _Compiled(
                hit=RuleHit(rule["id"], rule["label"], rule["category"], int(rule["weight"])),
                pattern=re.compile(rule["pattern"], flags),
            )
        )
    t = raw["thresholds"]
    return int(t["caution"]), int(t["danger"]), tuple(compiled)


def thresholds() -> tuple[int, int]:
    caution, danger, _ = _load()
    return caution, danger


def verdict_for(score: int) -> str:
    caution, danger = thresholds()
    if score >= danger:
        return "danger"
    if score >= caution:
        return "caution"
    return "safe"


def analyze(body: str) -> HeuristicResult:
    """Sum the weights of every matching rule (each counts once), clamp to 0..100."""
    _, _, rules = _load()
    hits = [c.hit for c in rules if c.pattern.search(body)]
    total = sum(h.weight for h in hits)
    return HeuristicResult(score=max(0, min(100, total)), hits=hits)
