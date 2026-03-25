"""
Jira integration – creates tickets for escalated triage results via REST API v3.
"""

from __future__ import annotations

import base64
import json
import logging
from urllib.error import URLError
from urllib.request import Request, urlopen

from config.settings import (
    JIRA_API_TOKEN,
    JIRA_EMAIL,
    JIRA_ENABLED,
    JIRA_PROJECT_KEY,
    JIRA_URL,
)
from models.triage import TriageResult

logger = logging.getLogger(__name__)

PRIORITY_MAP = {
    "CRITICAL": "Highest",
    "HIGH": "High",
    "MEDIUM": "Medium",
    "LOW": "Low",
}


def _auth_header() -> str:
    """Build the Basic-auth header value for Jira Cloud."""
    credentials = f"{JIRA_EMAIL}:{JIRA_API_TOKEN}"
    encoded = base64.b64encode(credentials.encode()).decode()
    return f"Basic {encoded}"


def _build_description(result: TriageResult) -> dict:
    """Build an ADF (Atlassian Document Format) description for the issue."""
    actions_text = "\n".join(f"• {a}" for a in result.recommended_actions)
    escalate_text = "YES – ESCALATE IMMEDIATELY" if result.escalate else "No"

    plain = (
        f"Summary: {result.summary}\n\n"
        f"MITRE ATT&CK Tactic: {result.mitre_tactic}\n"
        f"MITRE ATT&CK Technique: {result.mitre_technique}\n\n"
        f"Confidence: {result.confidence:.0%}\n"
        f"False-positive likelihood: {result.false_positive_likelihood:.0%}\n"
        f"Escalate: {escalate_text}\n\n"
        f"Recommended Actions:\n{actions_text}"
    )

    return {
        "version": 1,
        "type": "doc",
        "content": [
            {
                "type": "codeBlock",
                "attrs": {"language": "text"},
                "content": [{"type": "text", "text": plain}],
            }
        ],
    }


def _build_payload(result: TriageResult) -> dict:
    """Build the Jira REST API v3 issue creation payload."""
    priority_name = PRIORITY_MAP.get(result.priority.value, "Medium")
    summary = f"[{result.priority.value}] {result.alert_id} - {result.mitre_technique}"

    return {
        "fields": {
            "project": {"key": JIRA_PROJECT_KEY},
            "summary": summary,
            "description": _build_description(result),
            "issuetype": {"name": "Task"},
            "priority": {"name": priority_name},
        }
    }


def send_to_jira(result: TriageResult) -> bool:
    """Create a Jira issue for an escalated triage result.

    Only fires when JIRA_ENABLED is true AND the result has
    escalate=True with CRITICAL or HIGH priority.

    Returns True on success, False otherwise.
    """
    if not JIRA_ENABLED:
        logger.debug("Jira integration disabled – skipping.")
        return False

    if not (result.escalate and result.priority.value in {"CRITICAL", "HIGH"}):
        logger.debug(
            "Alert %s not eligible for Jira (priority=%s, escalate=%s) – skipping.",
            result.alert_id,
            result.priority.value,
            result.escalate,
        )
        return False

    if not all([JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY]):
        logger.warning("Jira configuration incomplete – cannot create issue.")
        return False

    url = f"{JIRA_URL.rstrip('/')}/rest/api/3/issue"
    payload = _build_payload(result)
    data = json.dumps(payload).encode("utf-8")

    req = Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": _auth_header(),
            "Accept": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode())
            issue_key = body.get("key", "???")
            logger.info(
                "Jira issue %s created for alert %s", issue_key, result.alert_id
            )
            return True
    except (URLError, OSError) as exc:
        logger.error(
            "Failed to create Jira issue for %s: %s", result.alert_id, exc
        )
        return False
