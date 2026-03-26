import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { readJSON, responseActionsPath, triageResultsPath } from "@/lib/data";
import { ResponseAction, ResponseActionEntry, TriageResult } from "@/lib/types";

const VALID_ACTIONS: ResponseAction[] = [
  "isolate_host",
  "block_ip",
  "reset_password",
  "dismiss",
];

const ACTION_DETAILS: Record<ResponseAction, string> = {
  isolate_host: "Simulated host isolation request",
  block_ip: "Simulated firewall block rule request",
  reset_password: "Simulated credential reset request",
  dismiss: "Alert dismissed by analyst",
};

// ---------------------------------------------------------------------------
// GET /api/alerts/[id]/respond
// Returns all response actions recorded for this alert.
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const allActions = (await readJSON(responseActionsPath)) as ResponseActionEntry[];
  const actions = allActions.filter((a) => a.alert_id === params.id);

  // Determine whether this alert qualifies for autonomous response.
  const triageResults = (await readJSON(triageResultsPath)) as TriageResult[];
  const triageEntry = triageResults.find((r) => r.alert_id === params.id);
  const auto_eligible =
    triageEntry !== undefined &&
    triageEntry.confidence >= 0.95 &&
    triageEntry.priority === "CRITICAL";

  return NextResponse.json({ actions, auto_eligible });
}

// ---------------------------------------------------------------------------
// POST /api/alerts/[id]/respond
// Records a new simulated response action for the alert.
// Writes atomically: response_actions.json.tmp → response_actions.json rename.
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: { action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Bad Request", message: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const action = body.action;

  if (!action || !VALID_ACTIONS.includes(action as ResponseAction)) {
    return NextResponse.json(
      {
        error: "Bad Request",
        message: `action must be one of: ${VALID_ACTIONS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const entry: ResponseActionEntry = {
    id: crypto.randomUUID(),
    alert_id: params.id,
    action: action as ResponseAction,
    analyst: "analyst",
    status: "simulated",
    timestamp: new Date().toISOString(),
    details: ACTION_DETAILS[action as ResponseAction],
  };

  // Read existing entries directly from disk (bypass cache for freshest state).
  let existing: ResponseActionEntry[] = [];
  try {
    const raw = await fs.readFile(responseActionsPath, "utf-8");
    existing = JSON.parse(raw) as ResponseActionEntry[];
  } catch {
    // File doesn't exist yet — start with empty list.
    existing = [];
  }

  const updated = [...existing, entry];

  // Atomic write: write to .tmp then rename.
  const tmpPath = responseActionsPath + ".tmp";
  await fs.mkdir(path.dirname(responseActionsPath), { recursive: true });
  await fs.writeFile(tmpPath, JSON.stringify(updated, null, 2), "utf-8");
  await fs.rename(tmpPath, responseActionsPath);

  return NextResponse.json({ success: true, action: entry }, { status: 201 });
}
