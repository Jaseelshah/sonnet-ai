"""Tests for agent.triage_agent – uses mocked API calls."""

import json
from unittest.mock import MagicMock, patch

import pytest

from agent.triage_agent import TriageAgent
from models.alert import Alert
from models.triage import Priority


MOCK_ALERT_DATA = {
    "id": "ALERT-TEST-001",
    "source": "TestSource",
    "timestamp": "2026-03-24T00:00:00+00:00",
    "severity": "HIGH",
    "title": "Test alert",
    "description": "Unit test alert",
    "source_ip": "10.0.0.1",
    "dest_ip": "10.0.0.2",
    "user": "testuser",
    "hostname": "test-host",
}

MOCK_API_RESPONSE = json.dumps({
    "alert_id": "ALERT-TEST-001",
    "priority": "HIGH",
    "confidence": 0.85,
    "summary": "Test triage summary.",
    "mitre_tactic": "Initial Access",
    "mitre_technique": "T1190 – Exploit Public-Facing Application",
    "recommended_actions": ["Patch the application", "Review access logs"],
    "escalate": True,
    "false_positive_likelihood": 0.1,
})


class TestTriageAgent:
    @patch("agent.triage_agent.anthropic")
    def test_triage_returns_result(self, mock_anthropic):
        # Arrange: mock the Anthropic client
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text=MOCK_API_RESPONSE)]
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_message
        mock_anthropic.Anthropic.return_value = mock_client

        agent = TriageAgent(api_key="test-key")
        alert = Alert.from_dict(MOCK_ALERT_DATA)

        # Act
        result = agent.triage(alert)

        # Assert
        assert result.alert_id == "ALERT-TEST-001"
        assert result.priority == Priority.HIGH
        assert result.confidence == 0.85
        assert result.escalate is True
        assert len(result.recommended_actions) == 2

    @patch("agent.triage_agent.anthropic")
    def test_triage_bad_json_raises(self, mock_anthropic):
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text="not valid json")]
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_message
        mock_anthropic.Anthropic.return_value = mock_client

        agent = TriageAgent(api_key="test-key")
        alert = Alert.from_dict(MOCK_ALERT_DATA)

        with pytest.raises(ValueError, match="invalid JSON"):
            agent.triage(alert)

    def test_missing_api_key_raises(self):
        with patch("agent.triage_agent.ANTHROPIC_API_KEY", ""):
            with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
                TriageAgent()

    @patch("agent.triage_agent.anthropic")
    def test_triage_handles_markdown_fences(self, mock_anthropic):
        """Claude sometimes wraps JSON in ```json ... ``` fences."""
        fenced = f"```json\n{MOCK_API_RESPONSE}\n```"
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text=fenced)]
        mock_client = MagicMock()
        mock_client.messages.create.return_value = mock_message
        mock_anthropic.Anthropic.return_value = mock_client

        agent = TriageAgent(api_key="test-key")
        alert = Alert.from_dict(MOCK_ALERT_DATA)
        result = agent.triage(alert)

        assert result.alert_id == "ALERT-TEST-001"
        assert result.priority == Priority.HIGH
