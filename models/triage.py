"""
Structured triage result returned by the SOC triage agent.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import Enum


class Priority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


@dataclass
class TriageResult:
    """Structured output of a single alert triage."""

    alert_id: str
    priority: Priority
    confidence: float          # 0.0 – 1.0
    summary: str               # plain-English explanation
    mitre_tactic: str          # e.g. "Credential Access"
    mitre_technique: str       # e.g. "T1110 – Brute Force"
    recommended_actions: list[str]
    escalate: bool
    false_positive_likelihood: float  # 0.0 – 1.0
    essential_eight_controls: list[str] = field(default_factory=list)
    tenant_id: str = ""
    triaged_at: datetime | None = None

    def __post_init__(self) -> None:
        if isinstance(self.priority, str):
            self.priority = Priority(self.priority.upper())
        self.confidence = max(0.0, min(1.0, self.confidence))
        self.false_positive_likelihood = max(0.0, min(1.0, self.false_positive_likelihood))
        if self.triaged_at is None:
            self.triaged_at = datetime.now(timezone.utc)

    # ── Factory ──────────────────────────────────────────────────────────
    @classmethod
    def from_dict(cls, data: dict) -> TriageResult:
        required_keys = ["alert_id", "priority", "confidence", "summary",
                         "mitre_tactic", "mitre_technique"]
        missing = [k for k in required_keys if k not in data]
        if missing:
            raise ValueError(
                f"Triage response missing required fields: {', '.join(missing)}. "
                f"Got keys: {list(data.keys())}"
            )
        return cls(
            alert_id=data["alert_id"],
            priority=data["priority"],
            confidence=float(data["confidence"]),
            summary=data["summary"],
            mitre_tactic=data["mitre_tactic"],
            mitre_technique=data["mitre_technique"],
            recommended_actions=data.get("recommended_actions", []),
            escalate=bool(data.get("escalate", False)),
            false_positive_likelihood=float(data.get("false_positive_likelihood", 0.0)),
            essential_eight_controls=data.get("essential_eight_controls", []),
            tenant_id=data.get("tenant_id", ""),
        )

    # ── Serialisation ────────────────────────────────────────────────────
    def to_dict(self) -> dict:
        d = asdict(self)
        d["priority"] = self.priority.value
        d["triaged_at"] = self.triaged_at.isoformat() if self.triaged_at else None
        return d

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)

    # ── Display ──────────────────────────────────────────────────────────
    def format_report(self, enrichment_summary: str = "") -> str:
        esc = "YES – ESCALATE" if self.escalate else "No"
        actions = "\n".join(f"  • {a}" for a in self.recommended_actions)
        parts = [
            f"{'═' * 60}",
            f"  TRIAGE REPORT – {self.alert_id}",
            f"{'═' * 60}",
            f"  Priority            : {self.priority.value}",
            f"  Confidence          : {self.confidence:.0%}",
            f"  Escalate            : {esc}",
            f"  False-positive      : {self.false_positive_likelihood:.0%}",
            f"  MITRE ATT&CK Tactic: {self.mitre_tactic}",
            f"  MITRE ATT&CK Tech  : {self.mitre_technique}",
            f"{'─' * 60}",
            f"  Summary:\n  {self.summary}",
            f"{'─' * 60}",
            f"  Recommended Actions:\n{actions}",
        ]
        if enrichment_summary:
            parts.append(f"{'─' * 60}")
            parts.append(enrichment_summary)
        parts.append(f"{'═' * 60}")
        return "\n".join(parts)
