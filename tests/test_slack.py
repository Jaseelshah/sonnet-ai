"""Tests for outputs.slack."""

from unittest.mock import patch

from models.triage import TriageResult
from outputs.slack import _build_slack_payload, send_to_slack


SAMPLE_RESULT = TriageResult.from_dict({
    "alert_id": "ALERT-001",
    "priority": "CRITICAL",
    "confidence": 0.95,
    "summary": "Active breach detected.",
    "mitre_tactic": "Execution",
    "mitre_technique": "T1059 – Command and Scripting Interpreter",
    "recommended_actions": ["Isolate host", "Collect forensics"],
    "escalate": True,
    "false_positive_likelihood": 0.02,
})


class TestSlackPayload:
    def test_payload_contains_priority(self):
        payload = _build_slack_payload(SAMPLE_RESULT)
        assert "CRITICAL" in payload["text"]

    def test_payload_contains_alert_id(self):
        payload = _build_slack_payload(SAMPLE_RESULT)
        assert "ALERT-001" in payload["text"]

    def test_escalate_flag_shown(self):
        payload = _build_slack_payload(SAMPLE_RESULT)
        assert "ESCALATE" in payload["text"]


class TestSendToSlack:
    @patch("outputs.slack.SLACK_ENABLED", False)
    def test_disabled_returns_false(self):
        assert send_to_slack(SAMPLE_RESULT) is False

    @patch("outputs.slack.SLACK_ENABLED", True)
    @patch("outputs.slack.SLACK_WEBHOOK_URL", "")
    def test_missing_url_returns_false(self):
        assert send_to_slack(SAMPLE_RESULT) is False
