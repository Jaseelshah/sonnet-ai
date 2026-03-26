"""
Identity-centric attack chain detection.

Tracks alerts per user across a rolling 1-hour window. When the same
user triggers 3+ alerts within that window, generates a synthetic
"Attack Chain Detected" alert linking all individual alerts.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from config.settings import LOG_DIR
from models.alert import Alert

logger = logging.getLogger(__name__)

_TRACKING_PATH = LOG_DIR / "user_tracking.json"
_WINDOW_HOURS = 1
_CHAIN_THRESHOLD = 3


def _load_tracking() -> dict[str, list[dict[str, Any]]]:
    """Load user tracking data from disk."""
    if not _TRACKING_PATH.exists():
        return {}
    try:
        return json.loads(_TRACKING_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_tracking(tracking: dict[str, list[dict[str, Any]]]) -> None:
    """Save user tracking data atomically."""
    _TRACKING_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = _TRACKING_PATH.with_suffix(".tmp")
    tmp.write_text(json.dumps(tracking, indent=2), encoding="utf-8")
    tmp.replace(_TRACKING_PATH)


def _prune_window(
    entries: list[dict[str, Any]], now: datetime
) -> list[dict[str, Any]]:
    """Remove entries older than the rolling window."""
    cutoff = (now - timedelta(hours=_WINDOW_HOURS)).isoformat()
    return [e for e in entries if e.get("timestamp", "") >= cutoff]


def track_alert(alert: Alert) -> Alert | None:
    """Track an alert by user. Returns a synthetic Attack Chain alert
    if the user has reached the chain threshold, otherwise None.

    Only tracks alerts that have a non-empty user field.
    """
    if not alert.user:
        return None

    now = datetime.now(timezone.utc)
    user_key = alert.user.lower()

    tracking = _load_tracking()

    # Get or create user entry
    user_entries = tracking.get(user_key, [])
    user_entries = _prune_window(user_entries, now)

    # Add current alert
    user_entries.append({
        "alert_id": alert.id,
        "title": alert.title,
        "severity": alert.severity,
        "timestamp": alert.timestamp.isoformat() if hasattr(alert.timestamp, 'isoformat') else str(alert.timestamp),
        "source_ip": alert.source_ip,
        "hostname": alert.hostname,
    })

    tracking[user_key] = user_entries
    _save_tracking(tracking)

    # Check threshold
    if len(user_entries) >= _CHAIN_THRESHOLD:
        # Only fire once per window — check if we already generated a chain alert
        chain_id = f"CHAIN-{user_key}-{now.strftime('%Y%m%d%H')}"
        chain_ids = [e.get("alert_id", "") for e in user_entries]
        if any(aid.startswith("CHAIN-") for aid in chain_ids):
            # Already generated a chain alert in this window
            return None

        alert_list = "\n".join(
            f"  - {e['alert_id']}: {e['title']} ({e['severity']})"
            for e in user_entries
            if not e['alert_id'].startswith("CHAIN-")
        )

        return Alert(
            id=chain_id,
            source="attack-chain-detector",
            timestamp=now,
            severity="HIGH",
            title=f"Attack Chain Detected — {len(user_entries)} alerts for user {alert.user}",
            description=(
                f"Multiple security alerts detected for user {alert.user} within "
                f"a {_WINDOW_HOURS}-hour window, suggesting a coordinated attack or "
                f"compromised account.\n\nRelated alerts:\n{alert_list}"
            ),
            source_ip=alert.source_ip,
            dest_ip=alert.dest_ip,
            user=alert.user,
            hostname=alert.hostname,
            raw={"chain_alerts": [e["alert_id"] for e in user_entries if not e["alert_id"].startswith("CHAIN-")]},
        )

    return None
