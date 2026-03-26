#!/usr/bin/env python3
"""
Sonnet-AI – SOC Triage Agent

Reads security alerts, triages them via the Claude API, and outputs
structured results to the console (and optionally Slack).

Supported alert sources
-----------------------
  mock     — loads a static JSON fixture from mock_data/alerts.json (default)
  elastic  — polls an Elasticsearch / Kibana SIEM index in a live loop
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

from config.settings import LOG_DIR, LOG_FORMAT, LOG_LEVEL, MOCK_DATA_DIR, validate
from enrichment.virustotal import enrich_alert, format_enrichment_summary
from models.alert import Alert
from models.triage import TriageResult
from agent.triage_agent import TriageAgent
from outputs.jira import send_to_jira
from outputs.slack import send_to_slack

# How long to wait between Elasticsearch poll cycles (seconds)
_ELASTIC_POLL_INTERVAL: int = 30


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


# ── Alert loading ─────────────────────────────────────────────────────────────

def load_alerts(path: Path | None = None) -> list[Alert]:
    path = path or (MOCK_DATA_DIR / "alerts.json")
    logger = logging.getLogger(__name__)
    logger.info("Loading alerts from %s", path)

    with open(path, encoding="utf-8") as f:
        raw_alerts: list[dict] = json.load(f)

    alerts = [Alert.from_dict(a) for a in raw_alerts]
    logger.info("Loaded %d alert(s)", len(alerts))
    return alerts


# ── Alert processing ──────────────────────────────────────────────────────────

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


def save_results(results: list[TriageResult], append: bool = False) -> Path:
    output_path = LOG_DIR / "triage_results.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    new_data = [r.to_dict() for r in results]

    if append and output_path.exists():
        existing_data: list[dict] = json.loads(output_path.read_text(encoding="utf-8"))
        existing_data.extend(new_data)
        combined = existing_data
    else:
        combined = new_data

    output_path.write_text(json.dumps(combined, indent=2), encoding="utf-8")

    logger = logging.getLogger(__name__)
    logger.info("Saved %d triage result(s) to %s", len(results), output_path)
    return output_path


# ── CLI argument parsing ──────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="sentinel-ai",
        description="Sonnet-AI — autonomous SOC triage agent",
    )
    parser.add_argument(
        "--source",
        choices=["mock", "elastic"],
        default="mock",
        help=(
            "Alert source: 'mock' loads a static JSON fixture (default); "
            "'elastic' polls an Elasticsearch SIEM index in a live loop."
        ),
    )
    return parser.parse_args()


# ── Startup banner ────────────────────────────────────────────────────────────

def print_banner(source: str) -> None:
    width = 60
    border = "=" * width
    source_label = f"Source: {source.upper()}"
    print(border)
    print("  Sentinel AI — SOC Triage Agent")
    print(f"  {source_label}")
    print(border)
    print()


# ── Source mode: mock ─────────────────────────────────────────────────────────

def run_mock() -> None:
    logger = logging.getLogger(__name__)
    logger.info("Running in MOCK mode")

    alerts = load_alerts()
    results = process_alerts(alerts)

    if results:
        save_results(results)

    print(f"\n{'=' * 60}")
    print("  Sentinel AI — Triage Complete")
    print(f"  Processed: {len(results)}/{len(alerts)} alerts")
    escalated = sum(1 for r in results if r.escalate)
    if escalated:
        print(f"  Escalated: {escalated}")
    print(f"{'=' * 60}")


# ── Source mode: elastic ──────────────────────────────────────────────────────

def run_elastic() -> None:
    """Poll Elasticsearch for new alerts in a continuous loop until Ctrl+C."""
    from parsers.elastic import ElasticAlertPoller

    logger = logging.getLogger(__name__)
    logger.info("Running in ELASTIC mode — index=%s", __import__("config.settings", fromlist=["ELASTIC_INDEX"]).ELASTIC_INDEX)

    poller = ElasticAlertPoller()

    if not poller.health_check():
        print(
            "\nERROR: Could not reach Elasticsearch. "
            "Check ELASTIC_URL, ELASTIC_USERNAME, and ELASTIC_PASSWORD in your .env file.\n",
            file=sys.stderr,
        )
        sys.exit(1)

    total_processed = 0
    total_escalated = 0
    cycle = 0

    print(f"Polling every {_ELASTIC_POLL_INTERVAL}s — press Ctrl+C to stop.\n")

    try:
        while True:
            cycle += 1
            logger.info("Poll cycle #%d starting", cycle)

            alerts = poller.poll()

            if alerts:
                results = process_alerts(alerts)
                save_results(results, append=True)

                cycle_escalated = sum(1 for r in results if r.escalate)
                total_processed += len(results)
                total_escalated += cycle_escalated

                print(f"\n[Cycle #{cycle}] Processed {len(results)} alert(s), {cycle_escalated} escalated.")
                print(f"Totals so far — processed: {total_processed}, escalated: {total_escalated}\n")
            else:
                logger.debug("Cycle #%d — no new alerts", cycle)

            logger.info(
                "Poll cycle #%d complete. Sleeping %ds.", cycle, _ELASTIC_POLL_INTERVAL
            )
            time.sleep(_ELASTIC_POLL_INTERVAL)

    except KeyboardInterrupt:
        print(f"\n{'=' * 60}")
        print("  Sentinel AI — Elastic polling stopped (Ctrl+C)")
        print(f"  Total alerts processed : {total_processed}")
        print(f"  Total escalated        : {total_escalated}")
        print(f"  Poll cycles completed  : {cycle}")
        print(f"{'=' * 60}\n")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    args = parse_args()

    setup_logging()
    logger = logging.getLogger(__name__)
    logger.info("Sentinel AI starting — source=%s", args.source)

    print_banner(args.source)

    # Validate configuration (emit warnings but do not abort)
    warnings = validate()
    for w in warnings:
        logger.warning(w)

    if args.source == "elastic":
        run_elastic()
    else:
        run_mock()


if __name__ == "__main__":
    main()
