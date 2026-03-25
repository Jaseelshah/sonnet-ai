"""Tests for models.triage."""

import json

from models.triage import Priority, TriageResult


SAMPLE_DATA = {
    "alert_id": "ALERT-001",
    "priority": "CRITICAL",
    "confidence": 0.92,
    "summary": "Brute-force attack succeeded.",
    "mitre_tactic": "Credential Access",
    "mitre_technique": "T1110 – Brute Force",
    "recommended_actions": ["Reset password", "Block source IP"],
    "escalate": True,
    "false_positive_likelihood": 0.05,
}


class TestTriageResult:
    def test_from_dict(self):
        result = TriageResult.from_dict(SAMPLE_DATA)
        assert result.priority == Priority.CRITICAL
        assert result.confidence == 0.92
        assert result.escalate is True

    def test_priority_coercion_from_lowercase(self):
        data = {**SAMPLE_DATA, "priority": "high"}
        result = TriageResult.from_dict(data)
        assert result.priority == Priority.HIGH

    def test_to_dict_roundtrip(self):
        result = TriageResult.from_dict(SAMPLE_DATA)
        d = result.to_dict()
        assert d["priority"] == "CRITICAL"
        assert d["alert_id"] == "ALERT-001"
        assert isinstance(d["triaged_at"], str)

    def test_to_json_is_valid(self):
        result = TriageResult.from_dict(SAMPLE_DATA)
        parsed = json.loads(result.to_json())
        assert parsed["confidence"] == 0.92

    def test_format_report_contains_key_sections(self):
        result = TriageResult.from_dict(SAMPLE_DATA)
        report = result.format_report()
        assert "CRITICAL" in report
        assert "ESCALATE" in report
        assert "T1110" in report
        assert "Reset password" in report

    def test_format_report_with_enrichment(self):
        result = TriageResult.from_dict(SAMPLE_DATA)
        enrichment = "  IOC Enrichment (VirusTotal):\n    !! IP 1.2.3.4 → MALICIOUS"
        report = result.format_report(enrichment)
        assert "MALICIOUS" in report
        # Enrichment should be inside the report borders, not create double borders
        assert report.count("═" * 60) == 3  # top, title underline, bottom

    def test_confidence_clamped(self):
        data = {**SAMPLE_DATA, "confidence": 1.5}
        result = TriageResult.from_dict(data)
        assert result.confidence == 1.0

    def test_false_positive_clamped(self):
        data = {**SAMPLE_DATA, "false_positive_likelihood": -0.2}
        result = TriageResult.from_dict(data)
        assert result.false_positive_likelihood == 0.0
