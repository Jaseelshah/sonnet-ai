"""
Sonnet AI MCP Server — exposes SOC triage capabilities as MCP tools.

Usage:
    python -m mcp_server.server

Or add to Claude Code's MCP config:
    {
        "mcpServers": {
            "sonnet-ai": {
                "command": "python",
                "args": ["-m", "mcp_server.server"],
                "cwd": "/path/to/sentinel-ai"
            }
        }
    }
"""

import json
import logging

from mcp.server.fastmcp import FastMCP

from config.settings import LOG_DIR, VIRUSTOTAL_ENABLED, VIRUSTOTAL_API_KEY
from models.alert import Alert
from agent.triage_agent import TriageAgent
from enrichment.virustotal import (
    enrich_alert,
    EnrichmentResult,
    _LOOKUP,
)

logger = logging.getLogger(__name__)

mcp = FastMCP(
    "Sonnet AI",
    description="Autonomous SOC triage agent — triage alerts, enrich IOCs, query results",
)

# Lazy-initialised agent (created on first triage request)
_agent: TriageAgent | None = None


def _get_agent() -> TriageAgent:
    global _agent
    if _agent is None:
        _agent = TriageAgent()
    return _agent


@mcp.tool()
def triage_alert(alert_json: str) -> str:
    """Triage a security alert using Claude AI.

    Accepts a JSON string representing a security alert with fields:
    id, source, timestamp, severity, title, description, source_ip,
    dest_ip, user, hostname.

    Returns the full triage result including priority, confidence,
    MITRE ATT&CK mapping, and recommended actions.
    """
    try:
        data = json.loads(alert_json)
        alert = Alert.from_dict(data)
    except json.JSONDecodeError as exc:
        return json.dumps({"error": f"Invalid JSON: {str(exc)}"})
    except Exception as exc:
        return json.dumps({"error": f"Failed to parse alert: {str(exc)}"})

    try:
        # Enrich IOCs via VirusTotal (no-op when disabled)
        vt_results = enrich_alert(alert)
        enrichment_context = "\n".join(r.to_prompt_context() for r in vt_results)

        agent = _get_agent()
        result = agent.triage(alert, enrichment_context)
        return json.dumps(result.to_dict(), indent=2)
    except ValueError as exc:
        return json.dumps({"error": str(exc)})
    except Exception as exc:
        logger.exception("Unexpected error triaging alert %s", alert.id)
        return json.dumps({"error": f"Triage failed: {str(exc)}"})


@mcp.tool()
def enrich_ioc(ioc_value: str, ioc_type: str) -> str:
    """Look up an IOC (Indicator of Compromise) in VirusTotal.

    Args:
        ioc_value: The IOC to look up (IP address, domain, or file hash)
        ioc_type: Type of IOC — "ip", "domain", or "hash"

    Returns reputation data from VirusTotal including malicious/suspicious
    engine counts and verdict.
    """
    if not VIRUSTOTAL_ENABLED:
        return json.dumps({
            "error": (
                "VirusTotal integration is not enabled. "
                "Set VIRUSTOTAL_ENABLED=true and provide VIRUSTOTAL_API_KEY."
            )
        })

    if not VIRUSTOTAL_API_KEY:
        return json.dumps({
            "error": "VIRUSTOTAL_API_KEY is not configured."
        })

    normalised_type = ioc_type.lower()
    lookup_fn = _LOOKUP.get(normalised_type)
    if lookup_fn is None:
        return json.dumps({
            "error": f"Invalid ioc_type: '{ioc_type}'. Must be 'ip', 'domain', or 'hash'."
        })

    try:
        result: EnrichmentResult = lookup_fn(ioc_value)
        return json.dumps({
            "ioc": result.ioc_value,
            "type": result.ioc_type,
            "verdict": result.verdict,
            "malicious": result.malicious_count,
            "suspicious": result.suspicious_count,
            "total_engines": result.total_engines,
            "tags": result.tags,
            "last_seen": result.last_seen,
        }, indent=2)
    except Exception as exc:
        logger.exception("VirusTotal lookup failed for %s (%s)", ioc_value, ioc_type)
        return json.dumps({"error": f"VirusTotal lookup failed: {str(exc)}"})


@mcp.tool()
def get_recent_alerts(limit: int = 10) -> str:
    """Get the most recent triaged alerts from the triage results log.

    Args:
        limit: Maximum number of alerts to return (default: 10)

    Returns a JSON array of the most recent triage results sorted by
    triage time (newest first).
    """
    results_path = LOG_DIR / "triage_results.json"
    if not results_path.exists():
        return json.dumps([])

    try:
        results = json.loads(results_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Failed to read triage results: %s", exc)
        return json.dumps([])

    results.sort(key=lambda x: x.get("triaged_at", ""), reverse=True)
    return json.dumps(results[:limit], indent=2)


@mcp.tool()
def get_stats() -> str:
    """Get dashboard statistics: total alerts, priority breakdown,
    MITRE tactic distribution, average confidence, and escalation rate.
    """
    results_path = LOG_DIR / "triage_results.json"
    if not results_path.exists():
        return json.dumps({"total_alerts": 0, "by_priority": {}, "by_mitre_tactic": {}})

    try:
        results = json.loads(results_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Failed to read triage results: %s", exc)
        return json.dumps({"total_alerts": 0, "by_priority": {}, "by_mitre_tactic": {}})

    total = len(results)
    if total == 0:
        return json.dumps({"total_alerts": 0, "by_priority": {}, "by_mitre_tactic": {}})

    by_priority: dict[str, int] = {}
    by_tactic: dict[str, int] = {}
    confidence_sum = 0.0
    escalated = 0

    for r in results:
        p = r.get("priority", "UNKNOWN")
        by_priority[p] = by_priority.get(p, 0) + 1

        t = r.get("mitre_tactic", "Unknown")
        by_tactic[t] = by_tactic.get(t, 0) + 1

        confidence_sum += float(r.get("confidence", 0))
        if r.get("escalate"):
            escalated += 1

    return json.dumps({
        "total_alerts": total,
        "by_priority": by_priority,
        "by_mitre_tactic": by_tactic,
        "average_confidence": round(confidence_sum / total, 3),
        "escalation_rate": round(escalated / total, 3),
    }, indent=2)


@mcp.tool()
def get_alert_by_id(alert_id: str) -> str:
    """Look up a specific triaged alert by its ID.

    Args:
        alert_id: The alert identifier to search for

    Returns the full triage result if found, or an error message.
    """
    results_path = LOG_DIR / "triage_results.json"
    if not results_path.exists():
        return json.dumps({"error": "No triage results found"})

    try:
        results = json.loads(results_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as exc:
        logger.warning("Failed to read triage results: %s", exc)
        return json.dumps({"error": "Failed to read triage results"})

    for r in results:
        if r.get("alert_id") == alert_id:
            return json.dumps(r, indent=2)

    return json.dumps({"error": f"Alert '{alert_id}' not found"})


if __name__ == "__main__":
    mcp.run()
