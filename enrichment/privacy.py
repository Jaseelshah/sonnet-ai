"""
Privacy-preserving PII redaction for security alerts.

When PRIVACY_MODE is enabled, sensitive identifiers are masked before
sending alert data to the Claude API, preventing PII from leaving
the organisation's boundary.
"""

from __future__ import annotations

import re
from models.alert import Alert

# Regex patterns for PII detection
_EMAIL_RE = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')
_PHONE_RE = re.compile(r'\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b')
_PRIVATE_IP_RE = re.compile(
    r'\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b'
)

# Common name patterns in hostnames (e.g., LAPTOP-JSMITH, PC-JOHNDOE)
_NAME_HOST_RE = re.compile(
    r'\b(?:LAPTOP|PC|DESKTOP|WS)-[A-Z][a-z]+[A-Z]?[a-z]*\b',
    re.IGNORECASE
)


def _redact_string(text: str) -> str:
    """Redact PII patterns from a string."""
    if not text:
        return text
    # Guard against extremely long strings that could cause ReDoS
    if len(text) > 50000:
        return "[CONTENT_TOO_LONG_REDACTED]"
    text = _EMAIL_RE.sub('[EMAIL_REDACTED]', text)
    text = _PHONE_RE.sub('[PHONE_REDACTED]', text)
    text = _PRIVATE_IP_RE.sub('[INTERNAL_IP]', text)
    text = _NAME_HOST_RE.sub('[HOST_REDACTED]', text)
    return text


def _redact_dict(data: dict) -> dict:
    """Recursively redact PII from a dict."""
    redacted = {}
    for key, value in data.items():
        if isinstance(value, str):
            redacted[key] = _redact_string(value)
        elif isinstance(value, dict):
            redacted[key] = _redact_dict(value)
        elif isinstance(value, list):
            redacted[key] = [
                _redact_dict(v) if isinstance(v, dict)
                else _redact_string(v) if isinstance(v, str)
                else v
                for v in value
            ]
        else:
            redacted[key] = value
    return redacted


def redact_pii(alert: Alert) -> Alert:
    """Return a new Alert with PII redacted.

    Creates a copy — the original Alert is not modified.
    The redacted version is used only for the Claude API call;
    the original is preserved in logs and the dashboard.
    """
    return Alert(
        id=alert.id,  # Keep ID intact
        source=alert.source,  # Keep source intact
        timestamp=alert.timestamp,
        severity=alert.severity,
        title=_redact_string(alert.title),
        description=_redact_string(alert.description),
        source_ip=_PRIVATE_IP_RE.sub('[INTERNAL_IP]', alert.source_ip) if alert.source_ip else "",
        dest_ip=_PRIVATE_IP_RE.sub('[INTERNAL_IP]', alert.dest_ip) if alert.dest_ip else "",
        user="[USER_REDACTED]" if alert.user else "",
        hostname=_redact_string(alert.hostname),
        raw=_redact_dict(dict(alert.raw)) if alert.raw else {},
    )
