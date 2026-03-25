"""
Slack integration – posts triage reports to a webhook.
"""

from __future__ import annotations

import json
import logging
from urllib.error import URLError
from urllib.request import Request, urlopen

from config.settings import SLACK_ENABLED, SLACK_WEBHOOK_URL
from models.triage import TriageResult

logger = logging.getLogger(__name__)

PRIORITY_EMOJI = {
    "CRITICAL": ":rotating_light:",
    "HIGH": ":warning:",
    "MEDIUM": ":large_yellow_circle:",
    "LOW": ":white_check_mark:",
}


def _build_slack_payload(
    result: TriageResult, enrichment_summary: str = ""
) -> dict:
    emoji = PRIORITY_EMOJI.get(result.priority.value, ":question:")
    actions = "\n".join(f"• {a}" for a in result.recommended_actions)
    escalate_text = "*YES – ESCALATE IMMEDIATELY*" if result.escalate else "No"

    text = (
        f"{emoji} *SOC Triage – {result.priority.value}* | `{result.alert_id}`\n"
        f"*Summary:* {result.summary}\n"
        f"*Confidence:* {result.confidence:.0%}  |  "
        f"*False-positive:* {result.false_positive_likelihood:.0%}\n"
        f"*MITRE:* {result.mitre_tactic} / {result.mitre_technique}\n"
        f"*Escalate:* {escalate_text}\n"
        f"*Actions:*\n{actions}"
    )
    if enrichment_summary:
        text += f"\n\n:mag: *IOC Enrichment (VirusTotal):*\n```{enrichment_summary}```"
    return {"text": text}


def send_to_slack(result: TriageResult, enrichment_summary: str = "") -> bool:
    """Post a triage report to the configured Slack webhook.

    Returns True on success, False otherwise.
    """
    if not SLACK_ENABLED:
        logger.debug("Slack notifications disabled – skipping.")
        return False

    if not SLACK_WEBHOOK_URL:
        logger.warning("SLACK_WEBHOOK_URL not configured – cannot send.")
        return False

    payload = _build_slack_payload(result, enrichment_summary)
    data = json.dumps(payload).encode("utf-8")
    req = Request(SLACK_WEBHOOK_URL, data=data, headers={"Content-Type": "application/json"})

    try:
        with urlopen(req, timeout=10) as resp:
            if resp.status == 200:
                logger.info("Slack notification sent for %s", result.alert_id)
                return True
            logger.warning("Slack returned HTTP %s for %s", resp.status, result.alert_id)
            return False
    except (URLError, OSError) as exc:
        logger.error("Failed to send Slack notification for %s: %s", result.alert_id, exc)
        return False
