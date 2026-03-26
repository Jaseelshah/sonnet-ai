#!/usr/bin/env python3
"""
wait-for-elastic.py

Polls Elasticsearch until the cluster health endpoint returns a green or
yellow status, then exits 0.  Exits 1 if the timeout is reached first.

Usage:
    python scripts/wait-for-elastic.py [--timeout SECONDS]

Environment:
    ELASTIC_URL   Base URL of the Elasticsearch cluster
                  (default: http://localhost:9200)

The script loads a .env file from the project root if one exists, so it
works correctly both inside and outside a Docker environment.
"""

import argparse
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


# ---------------------------------------------------------------------------
# .env loader (shared utility — see scripts/env_utils.py)
# ---------------------------------------------------------------------------

from env_utils import load_dotenv


# ---------------------------------------------------------------------------
# Elasticsearch health check
# ---------------------------------------------------------------------------

def _cluster_is_ready(elastic_url: str) -> bool:
    """
    Return True if Elasticsearch reports cluster health green or yellow.

    Returns False on any network error or unexpected response so that the
    caller can safely retry.
    """
    health_url = elastic_url.rstrip("/") + "/_cluster/health"
    try:
        with urllib.request.urlopen(health_url, timeout=5) as response:
            import json

            body = json.loads(response.read().decode("utf-8"))
            status = body.get("status", "")
            return status in ("green", "yellow")
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Main polling loop
# ---------------------------------------------------------------------------

def wait_for_elastic(elastic_url: str, timeout: int, interval: int = 5) -> int:
    """
    Poll Elasticsearch until it is ready or the timeout expires.

    Parameters
    ----------
    elastic_url:
        Base URL of the Elasticsearch cluster.
    timeout:
        Maximum number of seconds to wait before giving up.
    interval:
        Seconds to sleep between each retry attempt.

    Returns
    -------
    0 on success, 1 on timeout.
    """
    deadline = time.monotonic() + timeout
    attempt = 0

    print(f"Waiting for Elasticsearch at {elastic_url} (timeout={timeout}s) ...")

    while time.monotonic() < deadline:
        attempt += 1
        if _cluster_is_ready(elastic_url):
            elapsed = int(time.monotonic() - (deadline - timeout))
            print(f"Elasticsearch is ready (attempt {attempt}, ~{elapsed}s elapsed).")
            return 0

        remaining = int(deadline - time.monotonic())
        print(
            f"  [{attempt}] Not ready yet — retrying in {interval}s "
            f"({max(remaining, 0)}s remaining) ..."
        )
        time.sleep(interval)

    print(
        f"ERROR: Elasticsearch did not become ready within {timeout} seconds.",
        file=sys.stderr,
    )
    return 1


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Wait for Elasticsearch to report a healthy cluster status.",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=120,
        metavar="SECONDS",
        help="Maximum seconds to wait before giving up (default: 120).",
    )
    return parser.parse_args()


if __name__ == "__main__":
    # Load .env from the project root (two levels up from this script)
    _project_root = Path(__file__).resolve().parent.parent
    load_dotenv(_project_root / ".env")

    _args = _parse_args()

    _elastic_url: str = os.environ.get("ELASTIC_URL", "http://localhost:9200")

    sys.exit(wait_for_elastic(_elastic_url, timeout=_args.timeout))
