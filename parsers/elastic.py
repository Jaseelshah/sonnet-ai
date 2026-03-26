"""
parsers/elastic.py — Elasticsearch SIEM connector for Sentinel AI.

Polls an Elasticsearch / Kibana SIEM index for new alerts, converts each
hit to the project's normalised Alert model, and hands them back to the
main triage pipeline.

ECS field mapping reference:
  https://www.elastic.co/guide/en/ecs/current/ecs-field-reference.html
  https://www.elastic.co/guide/en/security/current/alert-schema.html
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from elasticsearch import Elasticsearch, ConnectionError as ESConnectionError, TransportError

from config.settings import (
    ELASTIC_INDEX,
    ELASTIC_PASSWORD,
    ELASTIC_URL,
    ELASTIC_USERNAME,
    ELASTIC_VERIFY_SSL,
)
from models.alert import Alert

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Severity normalisation
# ---------------------------------------------------------------------------

_SEVERITY_MAP: dict[str, str] = {
    "critical": "CRITICAL",
    "high": "HIGH",
    "medium": "MEDIUM",
    "low": "LOW",
    "informational": "INFO",
    "info": "INFO",
    "unknown": "UNKNOWN",
}

_POLL_WINDOW_MINUTES: int = 30  # initial look-back on first poll


def _normalise_severity(raw: str | None) -> str:
    """Map an ECS severity string to the model's uppercase convention."""
    if not raw:
        return "UNKNOWN"
    return _SEVERITY_MAP.get(raw.lower(), raw.upper())


# ---------------------------------------------------------------------------
# Elasticsearch query helpers
# ---------------------------------------------------------------------------

def _build_range_query(
    since: datetime,
    search_after: list[Any] | None = None,
) -> dict[str, Any]:
    """Return a bool/filter query selecting documents newer than *since*.

    When *search_after* is provided it is included in the query body so that
    Elasticsearch returns only results after that sort cursor (used for
    paginating beyond the first 500 hits).
    """
    body: dict[str, Any] = {
        "query": {
            "bool": {
                "filter": [
                    {
                        "range": {
                            "@timestamp": {
                                "gte": since.isoformat(),
                                "format": "strict_date_optional_time",
                            }
                        }
                    }
                ]
            }
        },
        "sort": [{"@timestamp": {"order": "asc"}}],
        "size": 500,
    }
    if search_after is not None:
        body["search_after"] = search_after
    return body


# ---------------------------------------------------------------------------
# ElasticAlertPoller
# ---------------------------------------------------------------------------

class ElasticAlertPoller:
    """Continuously polls an Elasticsearch SIEM index for new alert documents.

    Usage::

        poller = ElasticAlertPoller()
        if not poller.health_check():
            sys.exit("Elasticsearch unreachable")
        while True:
            new_alerts = poller.poll()
            process(new_alerts)
            time.sleep(30)
    """

    def __init__(self) -> None:
        auth: tuple[str, str] | None = (
            (ELASTIC_USERNAME, ELASTIC_PASSWORD)
            if ELASTIC_USERNAME and ELASTIC_PASSWORD
            else None
        )

        self._client = Elasticsearch(
            ELASTIC_URL,
            basic_auth=auth,
            verify_certs=ELASTIC_VERIFY_SSL,   # controlled by ELASTIC_VERIFY_SSL env var
            ssl_show_warn=ELASTIC_VERIFY_SSL,
            request_timeout=15,
            retry_on_timeout=True,
            max_retries=2,
        )
        self._index: str = ELASTIC_INDEX
        self.last_seen: datetime = datetime.now(timezone.utc) - timedelta(
            minutes=_POLL_WINDOW_MINUTES
        )
        self._seen_ids: set[str] = set()

        logger.info(
            "ElasticAlertPoller initialised — url=%s index=%s look_back=%dm",
            ELASTIC_URL,
            ELASTIC_INDEX,
            _POLL_WINDOW_MINUTES,
        )

    # ── Public API ────────────────────────────────────────────────────────

    def health_check(self) -> bool:
        """Return True if the Elasticsearch cluster is reachable and healthy."""
        try:
            info = self._client.info()
            cluster = info.get("cluster_name", "<unknown>")
            version = info.get("version", {}).get("number", "<unknown>")
            logger.info(
                "Elasticsearch healthy — cluster=%s version=%s", cluster, version
            )
            return True
        except (ESConnectionError, TransportError, Exception) as exc:
            logger.error("Elasticsearch health check failed: %s", exc)
            return False

    def poll(self) -> list[Alert]:
        """Query for documents newer than ``self.last_seen``.

        Paginates using ``search_after`` when a batch returns exactly 500 hits
        (indicating there may be more).  Deduplicates against ``_seen_ids`` to
        guard against overlap introduced by the ``gte`` range boundary.

        Updates ``self.last_seen`` to the timestamp of the newest hit so that
        subsequent calls never return stale documents.

        Returns an empty list on transient errors so the pipeline can continue.
        """
        since = self.last_seen
        logger.debug("Polling %s for alerts since %s", self._index, since.isoformat())

        all_hits: list[dict[str, Any]] = []
        search_after: list[Any] | None = None
        page = 0

        try:
            while True:
                page += 1
                query_body = _build_range_query(since, search_after)
                response = self._client.search(
                    index=self._index,
                    query=query_body["query"],
                    sort=query_body["sort"],
                    size=query_body["size"],
                    **({} if search_after is None else {"search_after": query_body["search_after"]}),
                )
                hits: list[dict[str, Any]] = response.get("hits", {}).get("hits", [])
                all_hits.extend(hits)

                if len(hits) < 500:
                    # Fewer than a full page — no more results to fetch
                    break

                # Full page returned: there may be more results
                if page == 1:
                    logger.warning(
                        "Pagination triggered for index=%s since=%s — "
                        "alert volume exceeds 500 per cycle",
                        self._index,
                        since.isoformat(),
                    )
                # Advance the cursor using the sort values of the last hit
                last_sort = hits[-1].get("sort")
                if not last_sort:
                    # No sort cursor available; cannot paginate further
                    break
                search_after = last_sort

        except (ESConnectionError, TransportError) as exc:
            logger.error("Elasticsearch query failed (transient): %s", exc)
            return []
        except Exception as exc:
            logger.error("Unexpected error during Elasticsearch poll: %s", exc)
            return []

        if not all_hits:
            logger.debug("No new alerts from Elasticsearch")
            return []

        alerts: list[Alert] = []
        newest_ts: datetime = since
        current_batch_ids: set[str] = set()

        for hit in all_hits:
            doc_id: str = hit.get("_id", "")
            if doc_id in self._seen_ids:
                # Duplicate introduced by gte overlap — skip
                continue
            current_batch_ids.add(doc_id)
            try:
                alert = self._to_alert(hit)
                alerts.append(alert)
                if alert.timestamp > newest_ts:
                    newest_ts = alert.timestamp
            except Exception as exc:
                logger.warning(
                    "Failed to convert Elasticsearch document %s to Alert: %s",
                    doc_id or "<unknown>",
                    exc,
                )

        # Replace seen-IDs with only this batch; older IDs won't appear again
        self._seen_ids = current_batch_ids

        # Advance the watermark only after successful parsing
        if newest_ts > self.last_seen:
            self.last_seen = newest_ts

        logger.info(
            "Polled %s — %d hit(s) across %d page(s), %d converted, watermark=%s",
            self._index,
            len(all_hits),
            page,
            len(alerts),
            self.last_seen.isoformat(),
        )
        return alerts

    # ── Private helpers ───────────────────────────────────────────────────

    def _to_alert(self, doc: dict[str, Any]) -> Alert:
        """Convert a raw Elasticsearch SIEM hit to the project's Alert model.

        Supports both Kibana Security alert documents (``kibana.alert.*``)
        and plain ECS documents produced by detection rules.
        """
        src: dict[str, Any] = doc.get("_source", {})

        # -- Identity ---------------------------------------------------------
        alert_id: str = (
            _nested_get(src, "kibana", "alert", "uuid")
            or doc.get("_id", "")
        )

        # -- Timestamp --------------------------------------------------------
        ts_raw: str = src.get("@timestamp", "")
        try:
            timestamp: datetime = datetime.fromisoformat(
                ts_raw.replace("Z", "+00:00")
            )
        except (ValueError, AttributeError):
            logger.debug(
                "Could not parse @timestamp %r for doc %s; using now()",
                ts_raw,
                doc.get("_id"),
            )
            timestamp = datetime.now(timezone.utc)

        # -- Severity ---------------------------------------------------------
        raw_severity: str | None = _nested_get(src, "kibana", "alert", "severity")
        severity: str = _normalise_severity(raw_severity)

        # -- Title / description ----------------------------------------------
        title: str = (
            _nested_get(src, "rule", "name")
            or _nested_get(src, "kibana", "alert", "rule", "name")
            or "Untitled alert"
        )
        description: str = (
            _nested_get(src, "kibana", "alert", "rule", "description")
            or _nested_get(src, "rule", "description")
            or ""
        )

        # -- Network context --------------------------------------------------
        source_ip: str = _nested_get(src, "source", "ip") or ""
        dest_ip: str = _nested_get(src, "destination", "ip") or ""

        # -- Identity context -------------------------------------------------
        user: str = _nested_get(src, "user", "name") or ""
        hostname: str = _nested_get(src, "host", "name") or ""

        return Alert(
            id=alert_id,
            source="elasticsearch",
            timestamp=timestamp,
            severity=severity,
            title=title,
            description=description,
            source_ip=source_ip,
            dest_ip=dest_ip,
            user=user,
            hostname=hostname,
            raw=src,
        )


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------

def _nested_get(data: dict[str, Any], *keys: str) -> Any:
    """Safely traverse a nested dict with dot-separated key segments.

    Handles both deeply-nested dicts and flat dicts whose keys contain dots
    (common in Elasticsearch ``_source`` documents).

    Example::

        _nested_get(src, "kibana", "alert", "severity")
        # tries src["kibana"]["alert"]["severity"]
        # then  src["kibana.alert.severity"]   (flat dot-key fallback)
    """
    # Deep traversal
    node: Any = data
    for key in keys:
        if not isinstance(node, dict):
            node = None
            break
        node = node.get(key)

    if node is not None:
        return node

    # Flat dot-key fallback (Elasticsearch sometimes flattens nested fields)
    flat_key = ".".join(keys)
    return data.get(flat_key)
