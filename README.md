# Sonnet AI

An autonomous SOC (Security Operations Centre) triage agent powered by Claude. Sonnet AI ingests security alerts from live Elasticsearch SIEM or static fixtures, enriches IOCs via VirusTotal, triages them using AI with MITRE ATT&CK mapping, and routes results to Slack and Jira — with a full Next.js web dashboard for real-time visibility.

---

## Features

- **AI-Powered Triage** — Sends normalised security alerts to Claude for severity assessment, MITRE ATT&CK classification, and actionable response recommendations.
- **IOC Enrichment** — Extracts IPs, domains, and file hashes from alerts and queries VirusTotal for reputation data before triage.
- **MITRE ATT&CK Mapping** — Every triaged alert is mapped to the most relevant ATT&CK tactic and technique.
- **Web Dashboard** — A full Next.js dashboard with real-time stats, alert drill-down, interactive charts, and a settings panel.
- **Slack Notifications** — Posts triage reports to a Slack channel via webhook for real-time analyst visibility.
- **Jira Ticket Creation** — Automatically creates Jira issues for escalated (CRITICAL/HIGH) alerts.
- **Live SIEM Integration** — Connects to Elasticsearch via a polling parser, with a built-in alert generator that simulates 8 real-world attack types using Elastic Common Schema (ECS) field names.
- **One-Click Demo** — Docker Compose environment with Elasticsearch + Kibana and launcher scripts that start the full stack in one command.
- **Structured Reporting** — Generates formatted console reports and persists results as JSON for downstream processing.
- **False-Positive Scoring** — Estimates false-positive likelihood to help analysts prioritise their queue.

---

## Architecture

```
┌──────────────┐    ┌──────────────┐    ┌───────────────┐
│Elasticsearch │───▶│  Sonnet AI   │───▶│  Slack / Jira │
│  SIEM Index  │    │  Python Agent│    │  (outputs)    │
└──────────────┘    └──────┬───────┘    └───────────────┘
       ▲                   │
┌──────┴───────┐    ┌──────▼───────┐
│    Alert     │    │   Claude API │
│  Generator   │    │   (triage)   │
└──────────────┘    └──────┬───────┘
                           │
                    ┌──────▼───────┐    ┌───────────────┐
                    │VirusTotal API│    │  Next.js Web  │
                    │ (enrichment) │    │  Dashboard    │
                    └──────────────┘    └───────────────┘
```

---

## Prerequisites

- Python 3.11+
- Node.js 18+ and npm (for the web dashboard)
- Docker and Docker Compose (for the Elasticsearch SIEM demo)
- An [Anthropic API key](https://console.anthropic.com/)
- (Optional) A [VirusTotal API key](https://www.virustotal.com/) for IOC enrichment
- (Optional) A Slack incoming webhook URL
- (Optional) Jira Cloud credentials for ticket creation

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/Jaseelshah/sonnet-ai.git
cd sonnet-ai

# Python setup
python -m venv venv
source venv/bin/activate        # Linux / macOS
venv\Scripts\activate           # Windows
pip install -r requirements.txt

# Web dashboard setup
cd webapp
npm install
cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your API keys (see Environment Variables below)
```

### 3. Run the Python triage agent

```bash
# Mock mode — triage static sample alerts (default)
python main.py

# Live mode — poll Elasticsearch for real-time alerts
python main.py --source elastic
```

In mock mode, the agent will:

1. Load alerts from `mock_data/alerts.json`
2. Extract and enrich IOCs via VirusTotal (if enabled)
3. Send each alert to Claude for AI triage
4. Print formatted triage reports to the console
5. Send Slack notifications and create Jira tickets (if enabled)
6. Save results to `logs/triage_results.json`

### 4. Start the web dashboard

```bash
cd webapp
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the dashboard. It reads triage results from `logs/triage_results.json` and displays them in real time.

**Production build:**

```bash
cd webapp
npm run build
npm start
```

Or use the convenience scripts:

```bash
./start.sh          # Linux / macOS
start.bat           # Windows
```

### 5. Run the full SIEM demo (Elasticsearch + Kibana)

Launch the complete stack with one command — Elasticsearch, Kibana, alert generator, triage agent, and web dashboard:

```bash
# Windows
start-demo.bat

# Linux / macOS
./start-demo.sh
```

This will:

1. Start Elasticsearch 8.11 and Kibana 8.11 via Docker Compose
2. Wait for Elasticsearch to become healthy
3. Launch the alert generator (produces ECS-compliant security alerts every 30s)
4. Launch the triage agent in live Elasticsearch mode
5. Start the Next.js dashboard at [http://localhost:3000](http://localhost:3000)

Services will be available at:

| Service | URL |
|---------|-----|
| **Dashboard** | [http://localhost:3000](http://localhost:3000) |
| **Kibana** | [http://localhost:5601](http://localhost:5601) |
| **Elasticsearch** | [http://localhost:9200](http://localhost:9200) |

The generator simulates 8 attack types: brute force, lateral movement, privilege escalation, data exfiltration, malware execution, port scanning, suspicious PowerShell, and failed MFA.

---

## Web Dashboard

The dashboard is a Next.js 14 app with five pages:

| Page | Route | Description |
|------|-------|-------------|
| **Dashboard** | `/` | Stat cards, priority bar chart, MITRE donut chart, recent alerts table |
| **Alerts Feed** | `/alerts` | Full searchable, filterable alert list |
| **Alert Detail** | `/alerts/[id]` | Deep-dive view with confidence bars, MITRE mapping, actions, raw JSON |
| **Reports** | `/reports` | Summary statistics with priority and MITRE technique charts |
| **Settings** | `/settings` | Configure model, integrations, and triage thresholds |

### API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/stats` | GET | Dashboard statistics (totals, breakdowns, averages) |
| `/api/alerts` | GET | Alerts list with `?search=` and `?priority=` filters |
| `/api/alerts/[id]` | GET | Single alert with full triage details |
| `/api/settings` | GET | Current configuration (keys masked) |
| `/api/settings` | POST | Update configuration |

---

## Environment Variables

Create a `.env` file in the project root (see `.env.example`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | — | Anthropic API key |
| `ANTHROPIC_MODEL` | No | `claude-sonnet-4-20250514` | Claude model to use |
| `ANTHROPIC_MAX_TOKENS` | No | `1024` | Max response tokens |
| `VIRUSTOTAL_ENABLED` | No | `false` | Enable IOC enrichment |
| `VIRUSTOTAL_API_KEY` | If VT enabled | — | VirusTotal API key |
| `SLACK_ENABLED` | No | `false` | Enable Slack notifications |
| `SLACK_WEBHOOK_URL` | If Slack enabled | — | Slack incoming webhook URL |
| `JIRA_ENABLED` | No | `false` | Enable Jira integration |
| `JIRA_URL` | If Jira enabled | — | Jira Cloud instance URL |
| `JIRA_EMAIL` | If Jira enabled | — | Jira account email |
| `JIRA_API_TOKEN` | If Jira enabled | — | Jira API token |
| `JIRA_PROJECT_KEY` | If Jira enabled | — | Jira project key |
| `ELASTIC_URL` | No | `http://localhost:9200` | Elasticsearch base URL |
| `ELASTIC_USERNAME` | No | — | Elasticsearch username (if auth enabled) |
| `ELASTIC_PASSWORD` | No | — | Elasticsearch password (if auth enabled) |
| `ELASTIC_INDEX` | No | `sonnet-ai-alerts` | Elasticsearch index for SIEM alerts |
| `ELASTIC_VERIFY_SSL` | No | `false` | Verify TLS certificates for Elasticsearch |
| `FALSE_POSITIVE_THRESHOLD` | No | `0.7` | Threshold for false-positive scoring |
| `LOG_LEVEL` | No | `INFO` | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |

---

## Running Tests

```bash
# Run all tests
python -m pytest tests/ -v

# Run with coverage
python -m pytest tests/ --cov=. --cov-report=term-missing
```

---

## Project Structure

```
sonnet-ai/
├── main.py                      # Entry point — orchestrates the triage pipeline
├── docker-compose.yml           # Elasticsearch 8.11 + Kibana 8.11
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment variable template
├── start.sh / start.bat         # Convenience scripts to launch the webapp
├── start-demo.sh / start-demo.bat  # Full SIEM demo launchers
│
├── agent/
│   ├── triage_agent.py          # Core agent — calls Claude API, parses response
│   └── prompt.py                # System and user prompts for the triage LLM
│
├── models/
│   ├── alert.py                 # Normalised security alert dataclass
│   └── triage.py                # Triage result with priority, MITRE mapping
│
├── parsers/
│   └── elastic.py               # Elasticsearch poller — ECS-to-Alert conversion
│
├── simulators/
│   └── elastic_generator.py     # Generates realistic ECS alerts into Elasticsearch
│
├── enrichment/
│   └── virustotal.py            # IOC extraction and VirusTotal v3 lookups
│
├── outputs/
│   ├── slack.py                 # Slack webhook integration
│   └── jira.py                  # Jira REST API v3 ticket creation
│
├── config/
│   └── settings.py              # Environment variable loading and validation
│
├── scripts/
│   ├── env_utils.py             # Shared .env file parser
│   └── wait-for-elastic.py      # Waits for Elasticsearch readiness
│
├── mock_data/
│   └── alerts.json              # Sample security alerts for testing
│
├── tests/
│   ├── test_alert.py            # Alert model tests
│   ├── test_triage.py           # Triage result tests
│   ├── test_triage_agent.py     # Agent tests (mocked API)
│   ├── test_slack.py            # Slack integration tests
│   └── test_virustotal.py       # IOC extraction and enrichment tests
│
├── logs/                        # Runtime outputs (gitignored)
│   ├── sentinel.log
│   └── triage_results.json
│
└── webapp/                      # Next.js 14 web dashboard
    ├── package.json
    ├── app/
    │   ├── layout.tsx           # Root layout with sidebar navigation
    │   ├── page.tsx             # Dashboard home — stats, charts, recent alerts
    │   ├── globals.css
    │   ├── alerts/
    │   │   ├── page.tsx         # Searchable, filterable alerts feed
    │   │   └── [id]/page.tsx    # Alert detail view
    │   ├── reports/page.tsx     # Reports with summary charts
    │   ├── settings/page.tsx    # Configuration panel
    │   └── api/
    │       ├── stats/route.ts   # GET /api/stats
    │       ├── alerts/
    │       │   ├── route.ts     # GET /api/alerts (with filters)
    │       │   └── [id]/route.ts# GET /api/alerts/[id]
    │       └── settings/route.ts# GET/POST /api/settings
    ├── components/
    │   ├── Sidebar.tsx          # Left navigation with status indicator
    │   ├── AlertsTable.tsx      # Reusable alerts table
    │   ├── PriorityBadge.tsx    # Colour-coded priority pill
    │   └── StatCard.tsx         # Dashboard stat card
    └── lib/
        ├── types.ts             # TypeScript interfaces
        └── utils.ts             # Utility functions
```

---

## Screenshots

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Alerts Feed
![Alerts Feed](docs/screenshots/alerts-feed.png)

### Alert Detail — Cobalt Strike Beacon
![Alert Detail](docs/screenshots/aler-detail.png)

### Reports
![Reports](docs/screenshots/reports.pmg.png)

### Settings
![Settings](docs/screenshots/settings.png)

<!-- Add these when screenshots are available:
### Terminal — Triage Run
![Terminal](docs/screenshots/terminal-triage.png)

### Slack Notifications
![Slack](docs/screenshots/slack-notification.png)

### Jira Tickets
![Jira](docs/screenshots/jira-ticket.png)
-->

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| AI Engine | [Claude API](https://docs.anthropic.com/) (Anthropic) |
| Backend Agent | Python 3.11+, Anthropic SDK |
| SIEM | Elasticsearch 8.11, Kibana 8.11 (Docker) |
| IOC Enrichment | VirusTotal API v3 |
| Web Dashboard | Next.js 14, React 18, TypeScript, Tailwind CSS |
| Charts | Recharts |
| Notifications | Slack Webhooks |
| Ticketing | Jira REST API v3 |

---

## Author

**Jaseel Shah** — [github.com/Jaseelshah](https://github.com/Jaseelshah)

---

## License

This project is for educational and authorised security operations use only.
