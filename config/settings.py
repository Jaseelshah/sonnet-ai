"""
Sonnet-AI configuration.

Loads environment variables and defines application-wide settings.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"
LOG_DIR = BASE_DIR / "logs"
MOCK_DATA_DIR = BASE_DIR / "mock_data"

load_dotenv(ENV_PATH)

# ── API ──────────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
ANTHROPIC_MAX_TOKENS: int = int(os.getenv("ANTHROPIC_MAX_TOKENS", "1024"))

# ── Slack ────────────────────────────────────────────────────────────────────
SLACK_WEBHOOK_URL: str = os.getenv("SLACK_WEBHOOK_URL", "")
SLACK_ENABLED: bool = os.getenv("SLACK_ENABLED", "false").lower() == "true"

# ── Jira ─────────────────────────────────────────────────────────────────────
JIRA_ENABLED: bool = os.getenv("JIRA_ENABLED", "false").lower() == "true"
JIRA_URL: str = os.getenv("JIRA_URL", "")
JIRA_EMAIL: str = os.getenv("JIRA_EMAIL", "")
JIRA_API_TOKEN: str = os.getenv("JIRA_API_TOKEN", "")
JIRA_PROJECT_KEY: str = os.getenv("JIRA_PROJECT_KEY", "")

# ── VirusTotal Enrichment ────────────────────────────────────────────────────
VIRUSTOTAL_ENABLED: bool = os.getenv("VIRUSTOTAL_ENABLED", "false").lower() == "true"
VIRUSTOTAL_API_KEY: str = os.getenv("VIRUSTOTAL_API_KEY", "")

# ── Triage thresholds ───────────────────────────────────────────────────────
ESCALATION_PRIORITIES: set[str] = {"CRITICAL", "HIGH"}
FALSE_POSITIVE_THRESHOLD: float = float(os.getenv("FALSE_POSITIVE_THRESHOLD", "0.7"))
ESCALATION_CONFIDENCE_THRESHOLD: float = float(os.getenv("ESCALATION_CONFIDENCE_THRESHOLD", "0.6"))

# ── Logging ──────────────────────────────────────────────────────────────────
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT: str = "%(asctime)s | %(name)-20s | %(levelname)-8s | %(message)s"

# ── Validation ───────────────────────────────────────────────────────────────
def validate() -> list[str]:
    """Return a list of configuration warnings (empty = all good)."""
    warnings: list[str] = []
    if not ANTHROPIC_API_KEY:
        warnings.append("ANTHROPIC_API_KEY is not set – API calls will fail.")
    if SLACK_ENABLED and not SLACK_WEBHOOK_URL:
        warnings.append("SLACK_ENABLED is true but SLACK_WEBHOOK_URL is empty.")
    if JIRA_ENABLED and not all([JIRA_URL, JIRA_EMAIL, JIRA_API_TOKEN, JIRA_PROJECT_KEY]):
        warnings.append("JIRA_ENABLED is true but Jira configuration is incomplete.")
    if VIRUSTOTAL_ENABLED and not VIRUSTOTAL_API_KEY:
        warnings.append("VIRUSTOTAL_ENABLED is true but VIRUSTOTAL_API_KEY is empty.")
    return warnings
