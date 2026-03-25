"""Tests for models.alert."""

from datetime import datetime, timezone

from models.alert import Alert


SAMPLE = {
    "id": "ALERT-001",
    "source": "CrowdStrike Falcon",
    "timestamp": "2026-03-24T02:14:33+00:00",
    "severity": "high",
    "title": "Brute-force attack",
    "description": "462 failed logins",
    "source_ip": "198.51.100.47",
    "dest_ip": "10.0.1.50",
    "user": "j.adams@acme.com",
    "hostname": "DC-EAST-01",
}


class TestAlertFromDict:
    def test_basic_fields(self):
        alert = Alert.from_dict(SAMPLE)
        assert alert.id == "ALERT-001"
        assert alert.severity == "HIGH"  # normalised to upper
        assert alert.source == "CrowdStrike Falcon"

    def test_timestamp_parsed(self):
        alert = Alert.from_dict(SAMPLE)
        assert isinstance(alert.timestamp, datetime)
        assert alert.timestamp.year == 2026

    def test_missing_id_generates_hash(self):
        data = {**SAMPLE}
        del data["id"]
        alert = Alert.from_dict(data)
        assert len(alert.id) == 12  # sha256 truncated

    def test_bad_timestamp_falls_back_to_now(self):
        data = {**SAMPLE, "timestamp": "not-a-date"}
        alert = Alert.from_dict(data)
        assert alert.timestamp.tzinfo == timezone.utc

    def test_to_prompt_context_contains_key_info(self):
        alert = Alert.from_dict(SAMPLE)
        ctx = alert.to_prompt_context()
        assert "ALERT-001" in ctx
        assert "198.51.100.47" in ctx
        assert "j.adams@acme.com" in ctx
