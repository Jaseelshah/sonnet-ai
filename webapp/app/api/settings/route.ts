import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { ROOT } from "@/lib/data";
import { validateOrigin } from "@/lib/csrf";
import { verifyToken, COOKIE_NAME } from "@/lib/auth";
import { audit, getClientIP } from "@/lib/audit";

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
    autonomy: {
      enabled: vars.AUTO_RESPONSE_ENABLED === "true",
      threshold: parseFloat(vars.AUTONOMY_THRESHOLD ?? "0.95"),
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
  const csrfError = validateOrigin(request);
  if (csrfError) return csrfError;

  // ---------------------------------------------------------------------------
  // RBAC: only admin-role users may modify settings.
  // ---------------------------------------------------------------------------
  const sessionToken = request.cookies.get(COOKIE_NAME)?.value;
  const sessionUser = sessionToken ? await verifyToken(sessionToken) : null;
  if (sessionUser && sessionUser.role !== "admin") {
    await audit({
      action: "settings_update",
      user: sessionUser.email,
      ip: getClientIP(request),
      outcome: "denied",
      details: "non-admin role",
    });
    return NextResponse.json({ error: "Forbidden: admin access required" }, { status: 403 });
  }

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

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Build a map of env var updates from the request body.
  // Only keys explicitly supported by the settings UI are touched — all other
  // env vars (CROWN_JEWELS, TENANTS, JWT_SECRET, ELASTIC_*, DASHBOARD_*, etc.)
  // are preserved verbatim from the existing .env file.
  const updates: Record<string, string> = {};

  if (body.anthropic) {
    if (body.anthropic.model) updates.ANTHROPIC_MODEL = body.anthropic.model;
    if (body.anthropic.max_tokens != null) updates.ANTHROPIC_MAX_TOKENS = String(body.anthropic.max_tokens);
    if (body.anthropic.api_key != null) updates.ANTHROPIC_API_KEY = body.anthropic.api_key;
  }
  if (body.slack) {
    updates.SLACK_ENABLED = body.slack.enabled ? "true" : "false";
    if (body.slack.webhook_url != null) updates.SLACK_WEBHOOK_URL = body.slack.webhook_url;
  }
  if (body.jira) {
    updates.JIRA_ENABLED = body.jira.enabled ? "true" : "false";
    if (body.jira.url != null) updates.JIRA_URL = body.jira.url;
    if (body.jira.email != null) updates.JIRA_EMAIL = body.jira.email;
    if (body.jira.api_token != null) updates.JIRA_API_TOKEN = body.jira.api_token;
    if (body.jira.project_key != null) updates.JIRA_PROJECT_KEY = body.jira.project_key;
  }
  if (body.virustotal) {
    updates.VIRUSTOTAL_ENABLED = body.virustotal.enabled ? "true" : "false";
    if (body.virustotal.api_key != null) updates.VIRUSTOTAL_API_KEY = body.virustotal.api_key;
  }
  if (body.triage) {
    if (body.triage.false_positive_threshold != null) updates.FALSE_POSITIVE_THRESHOLD = String(body.triage.false_positive_threshold);
    if (body.triage.log_level) updates.LOG_LEVEL = body.triage.log_level;
  }
  if (body.autonomy) {
    updates.AUTO_RESPONSE_ENABLED = body.autonomy.enabled ? "true" : "false";
    if (body.autonomy.threshold != null) updates.AUTONOMY_THRESHOLD = String(body.autonomy.threshold);
  }

  // Input validation: reject any value containing newlines, carriage returns, or null bytes.
  // These characters would corrupt the .env file format or enable injection attacks.
  for (const [key, value] of Object.entries(updates)) {
    if (/[\n\r\0]/.test(value)) {
      return NextResponse.json(
        { error: `Invalid value for ${key}: contains forbidden characters` },
        { status: 400 }
      );
    }
    // Drop masked values — the UI sends "****xxxx" placeholders for secrets
    // it never loaded. Writing them back would overwrite the real secret.
    if (value.includes("****")) {
      delete updates[key];
    }
  }

  // Read the existing .env line-by-line, preserving comments, blank lines, and
  // all keys not touched by this request. Only replace the specific keys that
  // appeared in the request body.
  let existingLines: string[] = [];
  try {
    const raw = await fs.readFile(ENV_PATH, "utf-8");
    existingLines = raw.split("\n");
  } catch {
    existingLines = [];
  }

  const updatedKeys = new Set<string>();
  const outputLines: string[] = [];

  for (const line of existingLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      outputLines.push(line);
      continue;
    }
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) {
      outputLines.push(line);
      continue;
    }
    const key = trimmed.substring(0, eqIdx).trim();
    if (key in updates) {
      outputLines.push(`${key}=${updates[key]}`);
      updatedKeys.add(key);
    } else {
      outputLines.push(line); // Preserve original line exactly
    }
  }

  // Append any keys from the request that were not already present in the file.
  for (const [key, value] of Object.entries(updates)) {
    if (!updatedKeys.has(key)) {
      outputLines.push(`${key}=${value}`);
    }
  }

  // Atomic write: write to a .tmp file then rename so readers never see a
  // partially-written file.
  const tmpPath = ENV_PATH + ".tmp";
  await fs.writeFile(tmpPath, outputLines.join("\n"), "utf-8");
  await fs.rename(tmpPath, ENV_PATH);

  await audit({
    action: "settings_update",
    user: sessionUser?.email || "unknown",
    ip: getClientIP(request),
    outcome: "success",
    details: Object.keys(updates).join(", "),
  });

  return NextResponse.json({ success: true });
}
