"""
Loads analyst corrections from logs/corrections.json and formats them
as few-shot examples for the triage prompt.
"""
import json
import logging
from pathlib import Path
from config.settings import LOG_DIR

logger = logging.getLogger(__name__)

CORRECTIONS_PATH = LOG_DIR / "corrections.json"


def load_relevant_corrections(
    alert_source: str = "",
    mitre_tactic: str = "",
    limit: int = 5,
) -> str:
    """Load the most relevant analyst corrections as few-shot context.

    Relevance is determined by matching alert_source or mitre_tactic.
    Falls back to the most recent corrections if no matches found.
    Returns a formatted string ready for prompt injection, or an empty
    string if no corrections exist yet.
    """
    if not CORRECTIONS_PATH.exists():
        return ""

    try:
        corrections = json.loads(CORRECTIONS_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        logger.warning("Could not read corrections file at %s", CORRECTIONS_PATH)
        return ""

    if not corrections:
        return ""

    # Score relevance: same source = +2, same tactic = +1
    scored = []
    for c in corrections:
        score = 0
        if alert_source and c.get("alert_source", "").lower() == alert_source.lower():
            score += 2
        if mitre_tactic and c.get("mitre_tactic", "").lower() == mitre_tactic.lower():
            score += 1
        scored.append((score, c))

    # Sort by score descending, then by timestamp descending (most recent first)
    scored.sort(key=lambda x: (x[0], x[1].get("timestamp", "")), reverse=True)

    top = [c for _, c in scored[:limit]]

    if not top:
        return ""

    lines = []
    for c in top:
        lines.append(
            f"- Alert: {c.get('alert_title', 'Unknown')} | "
            f"Source: {c.get('alert_source', '?')} | "
            f"Host: {c.get('hostname', '?')} | "
            f"AI said: {c.get('original_priority', '?')} → "
            f"Analyst corrected to: {c.get('corrected_priority', '?')}"
        )
        if c.get("analyst_note"):
            lines.append(f"  Reason: {c['analyst_note']}")

    return "\n".join(lines)
