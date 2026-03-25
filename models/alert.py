"""
Normalised security alert model.

Ingests raw alert JSON from any source (SIEM, EDR, cloud) and presents
a uniform interface for downstream triage.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass(frozen=True)
class Alert:
    """Source-agnostic security alert."""

    id: str
    source: str
    timestamp: datetime
    severity: str
    title: str
    description: str
    source_ip: str = ""
    dest_ip: str = ""
    user: str = ""
    hostname: str = ""
    raw: dict[str, Any] = field(default_factory=dict, repr=False)

    # ── Factory ──────────────────────────────────────────────────────────
    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> Alert:
        """Build an Alert from a raw JSON-style dict, normalising fields."""
        ts_raw = data.get("timestamp", "")
        try:
            ts = datetime.fromisoformat(ts_raw)
        except (ValueError, TypeError):
            ts = datetime.now(timezone.utc)

        return cls(
            id=data.get("id") or cls._generate_id(data),
            source=data.get("source", "unknown"),
            timestamp=ts,
            severity=data.get("severity", "UNKNOWN").upper(),
            title=data.get("title", "Untitled alert"),
            description=data.get("description", ""),
            source_ip=data.get("source_ip", ""),
            dest_ip=data.get("dest_ip", ""),
            user=data.get("user", ""),
            hostname=data.get("hostname", ""),
            raw=data,
        )

    # ── Helpers ──────────────────────────────────────────────────────────
    @staticmethod
    def _generate_id(data: dict[str, Any]) -> str:
        blob = json.dumps(data, sort_keys=True, default=str).encode()
        return hashlib.sha256(blob).hexdigest()[:12]

    def to_prompt_context(self) -> str:
        """Render the alert as a concise block suitable for an LLM prompt."""
        lines = [
            f"Alert ID   : {self.id}",
            f"Source     : {self.source}",
            f"Timestamp  : {self.timestamp.isoformat()}",
            f"Severity   : {self.severity}",
            f"Title      : {self.title}",
            f"Description: {self.description}",
        ]
        if self.source_ip:
            lines.append(f"Source IP  : {self.source_ip}")
        if self.dest_ip:
            lines.append(f"Dest IP    : {self.dest_ip}")
        if self.user:
            lines.append(f"User       : {self.user}")
        if self.hostname:
            lines.append(f"Hostname   : {self.hostname}")
        return "\n".join(lines)
