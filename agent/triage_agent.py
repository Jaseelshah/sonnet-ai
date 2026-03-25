"""
Core triage agent – sends normalised alerts to Claude and parses the response.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import anthropic

from agent.prompt import SYSTEM_PROMPT, build_user_prompt
from config.settings import ANTHROPIC_API_KEY, ANTHROPIC_MAX_TOKENS, ANTHROPIC_MODEL
from models.alert import Alert
from models.triage import TriageResult

logger = logging.getLogger(__name__)


class TriageAgent:
    """Stateless agent that triages one alert at a time via the Claude API."""

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self._api_key = api_key or ANTHROPIC_API_KEY
        self._model = model or ANTHROPIC_MODEL
        if not self._api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY is required. Set it in .env or pass it explicitly."
            )
        self._client = anthropic.Anthropic(api_key=self._api_key)

    # ── Public API ───────────────────────────────────────────────────────
    def triage(
        self, alert: Alert, enrichment_context: str = ""
    ) -> TriageResult:
        """Send an alert to Claude for triage and return a TriageResult."""
        logger.info("Triaging alert %s (%s)", alert.id, alert.title)

        user_prompt = build_user_prompt(
            alert.to_prompt_context(), enrichment_context
        )
        raw_response = self._call_api(user_prompt)
        result = self._parse_response(raw_response, alert.id)

        logger.info(
            "Alert %s triaged → %s (confidence %.0f%%, escalate=%s)",
            alert.id,
            result.priority.value,
            result.confidence * 100,
            result.escalate,
        )
        return result

    # ── Internals ────────────────────────────────────────────────────────
    def _call_api(self, user_prompt: str) -> str:
        """Call the Claude Messages API and return the raw text response."""
        message = self._client.messages.create(
            model=self._model,
            max_tokens=ANTHROPIC_MAX_TOKENS,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        if not message.content:
            raise ValueError("Claude returned an empty response (no content blocks).")
        return message.content[0].text

    @staticmethod
    def _strip_markdown_fences(text: str) -> str:
        """Remove markdown code fences (```json ... ```) if present."""
        stripped = text.strip()
        if stripped.startswith("```"):
            # Remove opening fence (```json or ```)
            newline_pos = stripped.find("\n")
            if newline_pos != -1:
                stripped = stripped[newline_pos + 1:]
            else:
                # Single-line: remove the opening ``` prefix
                stripped = stripped[3:]
                if stripped.startswith("json"):
                    stripped = stripped[4:]
        if stripped.endswith("```"):
            stripped = stripped[:-3]
        return stripped.strip()

    def _parse_response(self, raw: str, alert_id: str) -> TriageResult:
        """Parse Claude's JSON response into a TriageResult."""
        cleaned = self._strip_markdown_fences(raw)
        try:
            data: dict[str, Any] = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            logger.error("Failed to parse Claude response for %s: %s", alert_id, exc)
            raise ValueError(
                f"Claude returned invalid JSON for alert {alert_id}: {exc}"
            ) from exc

        # Guarantee the alert_id matches the original alert
        data["alert_id"] = alert_id
        return TriageResult.from_dict(data)
