# Changelog

All notable changes to Sonnet AI are documented in this file.

---

## Phase 6 — Live Elasticsearch SIEM Integration

- **Virtualized SIEM connector** — Docker Compose environment with Elasticsearch 8.11 and Kibana 8.11 for local SIEM simulation
- **Alert generator** (`simulators/elastic_generator.py`) — Produces realistic ECS-compliant security alerts across 8 attack types: brute force, lateral movement, privilege escalation, data exfiltration, malware execution, port scanning, suspicious PowerShell, and failed MFA
- **Elasticsearch parser** (`parsers/elastic.py`) — Polls Elasticsearch for new alerts, converts ECS documents to normalised `Alert` objects with pagination and deduplication
- **Live triage mode** — `python main.py --source elastic` runs a continuous polling loop against Elasticsearch instead of static JSON fixtures
- **One-click demo** — `start-demo.bat` (Windows) and `start-demo.sh` (Mac/Linux) launch the full stack: Elasticsearch, Kibana, alert generator, triage agent, and web dashboard
- **Shared environment utilities** (`scripts/env_utils.py`) — Centralised `.env` file parser used across standalone scripts
- **Health check script** (`scripts/wait-for-elastic.py`) — Waits for Elasticsearch readiness before starting dependent services
- Configurable TLS verification via `ELASTIC_VERIFY_SSL` environment variable
- RFC 5737 documentation IPs used in simulated alerts for safe, non-routable test data

## Phase 5 — Polish & Integration

- Added cross-platform start scripts (`start.sh`, `start.bat`)
- Comprehensive test suite across 5 test files
- Environment variable validation with actionable warnings
- Structured logging to `logs/sentinel.log`
- Mock alert data for demo and testing
- `.env.example` template for easy setup

## Phase 4 — Web Dashboard

- Built a full Next.js 14 web dashboard with 5 pages:
  - **Dashboard** (`/`) — stat cards, priority bar chart, MITRE donut chart, recent alerts
  - **Alerts Feed** (`/alerts`) — searchable, filterable alert list
  - **Alert Detail** (`/alerts/[id]`) — deep-dive view with confidence bars, MITRE mapping, raw JSON
  - **Reports** (`/reports`) — summary statistics and technique charts
  - **Settings** (`/settings`) — configure model, integrations, and triage thresholds
- 4 API routes serving stats, alerts, alert details, and settings
- Dark-themed UI with Tailwind CSS and Recharts visualisations
- Reads triage results from `logs/triage_results.json` produced by the Python agent

## Phase 3 — Output Integrations

- Slack webhook integration for real-time triage notifications
- Jira REST API v3 integration for automated ticket creation
- Conditional routing: only CRITICAL/HIGH escalated alerts create Jira tickets
- Priority-mapped formatting with emoji indicators for Slack

## Phase 2 — IOC Enrichment (VirusTotal)

- IOC extraction via regex: SHA-256/SHA-1/MD5 hashes, domains, IPv4 addresses
- VirusTotal API v3 lookups for IPs, domains, and file hashes
- Verdict determination: MALICIOUS, SUSPICIOUS, CLEAN, UNKNOWN
- Smart filtering: skips private IPs, internal domains, and filenames
- Rate-limiting for VirusTotal free-tier compliance (4 requests/min)
- Enrichment context injected into triage prompts for better analysis

## Phase 1 — Core Triage Agent

- `TriageAgent` class calling Claude API for alert analysis
- Normalised `Alert` dataclass accepting alerts from any SIEM/EDR source
- `TriageResult` dataclass with Priority enum and MITRE ATT&CK mapping
- System prompt engineered for SOC Tier-1 analyst persona
- JSON-structured responses: priority, confidence, summary, MITRE tactic/technique, recommended actions, escalation flag, false-positive likelihood
- Formatted console reports and JSON persistence
