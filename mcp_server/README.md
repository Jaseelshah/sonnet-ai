# Sonnet AI — MCP Server

Exposes the Sonnet AI SOC triage agent as an MCP (Model Context Protocol) server,
allowing Claude Code, Claude Desktop, or any MCP-compatible client to triage
security alerts, enrich IOCs, and query triage results.

## Available Tools

| Tool | Description |
|------|-------------|
| `triage_alert` | Send a security alert for AI-powered triage with MITRE ATT&CK mapping |
| `enrich_ioc` | Look up an IP, domain, or file hash in VirusTotal |
| `get_recent_alerts` | Retrieve the most recently triaged alerts |
| `get_stats` | Get dashboard statistics (priority breakdown, MITRE tactics, etc.) |
| `get_alert_by_id` | Look up a specific triaged alert by ID |

## Setup

### Claude Code

Add to your Claude Code MCP configuration:

```json
{
  "mcpServers": {
    "sonnet-ai": {
      "command": "python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "/path/to/sentinel-ai"
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "sonnet-ai": {
      "command": "python",
      "args": ["-m", "mcp_server.server"],
      "cwd": "/path/to/sentinel-ai"
    }
  }
}
```

### Standalone

```bash
cd /path/to/sentinel-ai
python -m mcp_server.server
```

## Example Usage (from Claude Code)

Once connected, you can ask Claude:

- "Triage this alert: {paste alert JSON}"
- "Look up the reputation of IP 192.168.1.100"
- "Show me the 5 most recent triaged alerts"
- "What are the current triage statistics?"
- "Find alert ALERT-2026-0451"

## Requirements

- Python 3.11+
- `mcp` Python package (`pip install mcp`)
- Sonnet AI configured with an Anthropic API key
- (Optional) VirusTotal API key for IOC enrichment
