import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { ROOT } from "@/lib/data";

const ENV_PATH = path.join(ROOT, ".env");

async function parseEnv(): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(ENV_PATH, "utf-8");
    const vars: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      vars[key] = value;
    }
    return vars;
  } catch {
    return {};
  }
}

function maskKey(value: string): string {
  if (!value || value.length < 8) return value;
  return "****" + value.slice(-4);
}

export async function GET() {
  const vars = await parseEnv();

  const settings = {
    anthropic: {
      model: vars.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
      max_tokens: parseInt(vars.ANTHROPIC_MAX_TOKENS ?? "1024"),
      api_key: maskKey(vars.ANTHROPIC_API_KEY ?? ""),
    },
    slack: {
      enabled: vars.SLACK_ENABLED === "true",
      // Webhook URL is masked to avoid leaking it through the browser-accessible API.
      webhook_url: maskKey(vars.SLACK_WEBHOOK_URL ?? ""),
    },
    jira: {
      enabled: vars.JIRA_ENABLED === "true",
      url: vars.JIRA_URL ?? "",
      email: vars.JIRA_EMAIL ?? "",
      api_token: maskKey(vars.JIRA_API_TOKEN ?? ""),
      project_key: vars.JIRA_PROJECT_KEY ?? "",
    },
    virustotal: {
      enabled: vars.VIRUSTOTAL_ENABLED === "true",
      api_key: maskKey(vars.VIRUSTOTAL_API_KEY ?? ""),
    },
    triage: {
      false_positive_threshold: parseFloat(vars.FALSE_POSITIVE_THRESHOLD ?? "0.7"),
      log_level: vars.LOG_LEVEL ?? "INFO",
    },
  };

  return NextResponse.json({ settings });
}

export async function POST(request: NextRequest) {
  // ---------------------------------------------------------------------------
  // API key authentication.
  // If SETTINGS_API_KEY is set in the environment, the request must supply a
  // matching X-API-Key header. If the env var is absent (development mode) the
  // check is skipped and a warning is logged to the server console.
  // ---------------------------------------------------------------------------
  const expectedKey = process.env.SETTINGS_API_KEY;
  if (expectedKey) {
    const providedKey = request.headers.get("X-API-Key");
    if (providedKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else {
    console.warn(
      "[settings POST] SETTINGS_API_KEY is not set — running in unauthenticated development mode"
    );
  }

  const body = await request.json();
  const currentVars = await parseEnv();

  // Map settings back to env vars
  const updates: Record<string, string> = {};

  if (body.anthropic) {
    if (body.anthropic.model) updates.ANTHROPIC_MODEL = body.anthropic.model;
    if (body.anthropic.max_tokens) updates.ANTHROPIC_MAX_TOKENS = String(body.anthropic.max_tokens);
    if (body.anthropic.api_key && !body.anthropic.api_key.includes("****")) {
      updates.ANTHROPIC_API_KEY = body.anthropic.api_key;
    }
  }
  if (body.slack) {
    updates.SLACK_ENABLED = String(body.slack.enabled);
    if (body.slack.webhook_url !== undefined && !body.slack.webhook_url.includes("****")) {
      updates.SLACK_WEBHOOK_URL = body.slack.webhook_url;
    }
  }
  if (body.jira) {
    updates.JIRA_ENABLED = String(body.jira.enabled);
    if (body.jira.url !== undefined) updates.JIRA_URL = body.jira.url;
    if (body.jira.email !== undefined) updates.JIRA_EMAIL = body.jira.email;
    if (body.jira.project_key !== undefined) updates.JIRA_PROJECT_KEY = body.jira.project_key;
    if (body.jira.api_token && !body.jira.api_token.includes("****")) {
      updates.JIRA_API_TOKEN = body.jira.api_token;
    }
  }
  if (body.virustotal) {
    updates.VIRUSTOTAL_ENABLED = String(body.virustotal.enabled);
    if (body.virustotal.api_key && !body.virustotal.api_key.includes("****")) {
      updates.VIRUSTOTAL_API_KEY = body.virustotal.api_key;
    }
  }
  if (body.triage) {
    if (body.triage.false_positive_threshold !== undefined) {
      updates.FALSE_POSITIVE_THRESHOLD = String(body.triage.false_positive_threshold);
    }
    if (body.triage.log_level) updates.LOG_LEVEL = body.triage.log_level;
  }

  const merged = { ...currentVars, ...updates };

  // Write .env file
  const lines = [
    "# Anthropic API",
    `ANTHROPIC_API_KEY=${merged.ANTHROPIC_API_KEY ?? ""}`,
    `ANTHROPIC_MODEL=${merged.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514"}`,
    `ANTHROPIC_MAX_TOKENS=${merged.ANTHROPIC_MAX_TOKENS ?? "1024"}`,
    "",
    "# Slack Integration",
    `SLACK_ENABLED=${merged.SLACK_ENABLED ?? "false"}`,
    `SLACK_WEBHOOK_URL=${merged.SLACK_WEBHOOK_URL ?? ""}`,
    "",
    "# Jira Integration",
    `JIRA_ENABLED=${merged.JIRA_ENABLED ?? "false"}`,
    `JIRA_URL=${merged.JIRA_URL ?? ""}`,
    `JIRA_EMAIL=${merged.JIRA_EMAIL ?? ""}`,
    `JIRA_API_TOKEN=${merged.JIRA_API_TOKEN ?? ""}`,
    `JIRA_PROJECT_KEY=${merged.JIRA_PROJECT_KEY ?? ""}`,
    "",
    "# VirusTotal Enrichment",
    `VIRUSTOTAL_ENABLED=${merged.VIRUSTOTAL_ENABLED ?? "false"}`,
    `VIRUSTOTAL_API_KEY=${merged.VIRUSTOTAL_API_KEY ?? ""}`,
    "",
    "# Triage Tuning",
    `FALSE_POSITIVE_THRESHOLD=${merged.FALSE_POSITIVE_THRESHOLD ?? "0.7"}`,
    `LOG_LEVEL=${merged.LOG_LEVEL ?? "INFO"}`,
    "",
  ];

  await fs.writeFile(ENV_PATH, lines.join("\n"), "utf-8");

  return NextResponse.json({ success: true });
}
