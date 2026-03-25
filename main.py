#!/usr/bin/env python3
"""
Sonnet-AI – SOC Triage Agent

Reads security alerts, triages them via the Claude API, and outputs
structured results to the console (and optionally Slack).
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

from config.settings import LOG_DIR, LOG_FORMAT, LOG_LEVEL, MOCK_DATA_DIR, validate
from enrichment.virustotal import enrich_alert, format_enrichment_summary
from models.alert import Alert
from models.triage import TriageResult
from agent.triage_agent import TriageAgent
from outputs.jira import send_to_jira
from outputs.slack import send_to_slack


def setup_logging() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL, logging.INFO),
        format=LOG_FORMAT,
        handlers=[
            logging.StreamHandler(sys.stderr),
            logging.FileHandler(LOG_DIR / "sentinel.log", encoding="utf-8"),
        ],
        force=True,
    )


def load_alerts(path: Path | None = None) -> list[Alert]:
    path = path or (MOCK_DATA_DIR / "alerts.json")
    logger = logging.getLogger(__name__)
    logger.info("Loading alerts from %s", path)

    with open(path, encoding="utf-8") as f:
        raw_alerts: list[dict] = json.load(f)

    alerts = [Alert.from_dict(a) for a in raw_alerts]
    logger.info("Loaded %d alert(s)", len(alerts))
    return alerts


def process_alerts(alerts: list[Alert]) -> list[TriageResult]:
    logger = logging.getLogger(__name__)
    agent = TriageAgent()
    results: list[TriageResult] = []

    for alert in alerts:
        try:
            # Phase 4: enrich IOCs via VirusTotal before triage
            vt_results = enrich_alert(alert)
            enrichment_context = "\n".join(
                r.to_prompt_context() for r in vt_results
            )
            enrichment_summary = format_enrichment_summary(vt_results)

            result = agent.triage(alert, enrichment_context)
            results.append(result)

            # Print the report to console (with enrichment)
            report = result.format_report(enrichment_summary)
            print(report)
            print()

            # Attempt Slack notification (with enrichment)
            send_to_slack(result, enrichment_summary)

            # Create Jira ticket for escalated alerts
            send_to_jira(result)

        except Exception:
            logger.exception("Failed to triage alert %s", alert.id)

    return results


def save_results(results: list[TriageResult]) -> Path:
    output_path = LOG_DIR / "triage_results.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    data = [r.to_dict() for r in results]
    output_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    logger = logging.getLogger(__name__)
    logger.info("Saved %d triage result(s) to %s", len(results), output_path)
    return output_path


def main() -> None:
    setup_logging()
    logger = logging.getLogger(__name__)
    logger.info("Sonnet-AI starting")

    # Validate config
    warnings = validate()
    for w in warnings:
        logger.warning(w)

    # Load → Triage → Save
    alerts = load_alerts()
    results = process_alerts(alerts)

    if results:
        save_results(results)

    # Summary
    print(f"\n{'═' * 60}")
    print(f"  Sonnet-AI – Triage Complete")
    print(f"  Processed: {len(results)}/{len(alerts)} alerts")
    escalated = sum(1 for r in results if r.escalate)
    if escalated:
        print(f"  Escalated: {escalated}")
    print(f"{'═' * 60}")


if __name__ == "__main__":
    main()
