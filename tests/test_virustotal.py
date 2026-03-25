"""
Tests for the VirusTotal IOC enrichment module.
"""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from enrichment.virustotal import (
    EnrichmentResult,
    _parse_analysis_stats,
    _refang_domain,
    extract_iocs,
    format_enrichment_summary,
)
from models.alert import Alert


# ── Fixtures ─────────────────────────────────────────────────────────────────
@pytest.fixture
def brute_force_alert() -> Alert:
    return Alert.from_dict({
        "id": "ALERT-001",
        "source": "Azure AD",
        "timestamp": "2026-03-24T02:14:33+00:00",
        "severity": "HIGH",
        "title": "Brute-force attack",
        "description": "Failed logins from 198.51.100.47",
        "source_ip": "198.51.100.47",
        "dest_ip": "10.0.1.50",
    })


@pytest.fixture
def exfil_alert() -> Alert:
    return Alert.from_dict({
        "id": "ALERT-002",
        "source": "Palo Alto NGFW",
        "timestamp": "2026-03-24T05:42:18+00:00",
        "severity": "HIGH",
        "title": "Data exfiltration",
        "description": (
            "Host 10.0.5.22 transferred 4.7 GB to 203.0.113.88 over HTTPS. "
            "DNS resolved to xfer-cdn-node9[.]com registered 48h ago."
        ),
        "source_ip": "10.0.5.22",
        "dest_ip": "203.0.113.88",
    })


@pytest.fixture
def hash_alert() -> Alert:
    return Alert.from_dict({
        "id": "ALERT-003",
        "source": "CrowdStrike",
        "timestamp": "2026-03-24T06:18:02+00:00",
        "severity": "CRITICAL",
        "title": "Cobalt Strike beacon",
        "description": (
            "Reflective DLL loaded with sha256: "
            "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2 "
            "calling back to 192.0.2.33:443"
        ),
        "source_ip": "10.0.4.88",
        "dest_ip": "192.0.2.33",
    })


# ── IOC extraction ───────────────────────────────────────────────────────────
class TestExtractIOCs:
    def test_extracts_public_source_ip(self, brute_force_alert: Alert) -> None:
        iocs = extract_iocs(brute_force_alert)
        assert "198.51.100.47" in iocs
        assert iocs["198.51.100.47"] == "ip"

    def test_skips_private_dest_ip(self, brute_force_alert: Alert) -> None:
        iocs = extract_iocs(brute_force_alert)
        assert "10.0.1.50" not in iocs

    def test_extracts_defanged_domain(self, exfil_alert: Alert) -> None:
        iocs = extract_iocs(exfil_alert)
        assert "xfer-cdn-node9.com" in iocs
        assert iocs["xfer-cdn-node9.com"] == "domain"

    def test_extracts_public_dest_ip(self, exfil_alert: Alert) -> None:
        iocs = extract_iocs(exfil_alert)
        assert "203.0.113.88" in iocs

    def test_extracts_sha256_hash(self, hash_alert: Alert) -> None:
        iocs = extract_iocs(hash_alert)
        expected = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
        assert expected in iocs
        assert iocs[expected] == "hash"

    def test_extracts_ip_from_description(self, hash_alert: Alert) -> None:
        iocs = extract_iocs(hash_alert)
        assert "192.0.2.33" in iocs

    def test_empty_alert_returns_empty(self) -> None:
        alert = Alert.from_dict({
            "id": "ALERT-EMPTY",
            "source": "test",
            "severity": "LOW",
            "title": "Nothing here",
            "description": "No IOCs at all",
        })
        iocs = extract_iocs(alert)
        assert len(iocs) == 0


# ── Defanging ────────────────────────────────────────────────────────────────
class TestRefangDomain:
    def test_refangs_single_bracket(self) -> None:
        assert _refang_domain("evil[.]com") == "evil.com"

    def test_refangs_multiple_brackets(self) -> None:
        assert _refang_domain("sub[.]evil[.]com") == "sub.evil.com"


# ── VT response parsing ─────────────────────────────────────────────────────
class TestParseAnalysisStats:
    def test_malicious_verdict(self) -> None:
        data = {
            "data": {
                "attributes": {
                    "last_analysis_stats": {
                        "malicious": 12,
                        "suspicious": 2,
                        "harmless": 50,
                        "undetected": 10,
                    },
                    "tags": ["trojan", "c2"],
                    "last_analysis_date": 1711234567,
                }
            }
        }
        result = _parse_analysis_stats(data, "198.51.100.47", "ip")
        assert result.verdict == "MALICIOUS"
        assert result.malicious_count == 12
        assert result.suspicious_count == 2
        assert result.total_engines == 74
        assert "trojan" in result.tags

    def test_clean_verdict(self) -> None:
        data = {
            "data": {
                "attributes": {
                    "last_analysis_stats": {
                        "malicious": 0,
                        "suspicious": 0,
                        "harmless": 60,
                        "undetected": 10,
                    },
                }
            }
        }
        result = _parse_analysis_stats(data, "8.8.8.8", "ip")
        assert result.verdict == "CLEAN"
        assert result.malicious_count == 0

    def test_unknown_when_empty(self) -> None:
        data = {"data": {"attributes": {}}}
        result = _parse_analysis_stats(data, "x", "ip")
        assert result.verdict == "UNKNOWN"


# ── EnrichmentResult ─────────────────────────────────────────────────────────
class TestEnrichmentResult:
    def test_to_dict_roundtrip(self) -> None:
        r = EnrichmentResult(
            ioc_value="198.51.100.47",
            ioc_type="ip",
            malicious_count=5,
            suspicious_count=1,
            total_engines=70,
            verdict="MALICIOUS",
            tags=["c2"],
            last_seen="2026-03-24T00:00:00+00:00",
        )
        d = r.to_dict()
        assert d["verdict"] == "MALICIOUS"
        assert d["malicious_count"] == 5

    def test_to_prompt_context(self) -> None:
        r = EnrichmentResult(
            ioc_value="evil.com",
            ioc_type="domain",
            malicious_count=8,
            total_engines=70,
            verdict="MALICIOUS",
        )
        ctx = r.to_prompt_context()
        assert "evil.com" in ctx
        assert "MALICIOUS" in ctx


# ── Summary formatting ───────────────────────────────────────────────────────
class TestFormatEnrichmentSummary:
    def test_empty_returns_empty(self) -> None:
        assert format_enrichment_summary([]) == ""

    def test_includes_all_results(self) -> None:
        results = [
            EnrichmentResult("1.2.3.4", "ip", 5, 0, 70, "MALICIOUS"),
            EnrichmentResult("safe.com", "domain", 0, 0, 70, "CLEAN"),
        ]
        summary = format_enrichment_summary(results)
        assert "1.2.3.4" in summary
        assert "safe.com" in summary
        assert "MALICIOUS" in summary
        assert "CLEAN" in summary
