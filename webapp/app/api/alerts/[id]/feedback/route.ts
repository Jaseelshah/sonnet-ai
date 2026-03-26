import fs from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { readJSON, feedbackPath, correctionsPath, triageResultsPath, rawAlertsPath } from "@/lib/data";
import { AlertFeedback, FeedbackStatus, Priority, TriageResult } from "@/lib/types";

// ---------------------------------------------------------------------------
// GET /api/alerts/[id]/feedback
// Returns the existing feedback entry for a single alert, or null.
// ---------------------------------------------------------------------------
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const allFeedback = (await readJSON(feedbackPath)) as AlertFeedback[];
  const entry = allFeedback.find((f) => f.alert_id === params.id) ?? null;
  return NextResponse.json({ feedback: entry });
}

// ---------------------------------------------------------------------------
// POST /api/alerts/[id]/feedback
// Creates or replaces the feedback entry for an alert.
// Writes atomically: feedback.json.tmp → feedback.json rename.
// ---------------------------------------------------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = (await req.json()) as {
    status: FeedbackStatus;
    corrected_priority?: string;
    analyst_note?: string;
  };

  // Read existing feedback directly from disk (bypass cache so we always
  // have the freshest list before appending).
  let existing: AlertFeedback[] = [];
  try {
    const raw = await fs.readFile(feedbackPath, "utf-8");
    existing = JSON.parse(raw) as AlertFeedback[];
  } catch {
    // File doesn't exist yet — start with empty list.
    existing = [];
  }

  const entry: AlertFeedback = {
    alert_id: params.id,
    status: body.status,
    ...(body.corrected_priority
      ? { corrected_priority: body.corrected_priority as Priority }
      : {}),
    ...(body.analyst_note !== undefined && body.analyst_note !== ""
      ? { analyst_note: body.analyst_note }
      : {}),
    reviewed_at: new Date().toISOString(),
    reviewed_by: "analyst",
  };

  // Replace existing entry for this alert_id or append new one.
  const updated = [
    ...existing.filter((f) => f.alert_id !== params.id),
    entry,
  ];

  // Atomic write: write to tmp file then rename.
  const tmpPath = feedbackPath + ".tmp";
  await fs.mkdir(path.dirname(feedbackPath), { recursive: true });
  await fs.writeFile(tmpPath, JSON.stringify(updated, null, 2), "utf-8");
  await fs.rename(tmpPath, feedbackPath);

  // When a verdict is corrected, append a structured entry to corrections.json
  // so the triage agent can use it as a few-shot example in future prompts.
  if (body.status === "corrected" && body.corrected_priority) {
    try {
      const [allTriageResults, allRawAlerts] = await Promise.all([
        readJSON(triageResultsPath) as Promise<TriageResult[]>,
        readJSON(rawAlertsPath) as Promise<Record<string, unknown>[]>,
      ]);
      const triageEntry = (allTriageResults as TriageResult[]).find(
        (tr) => tr.alert_id === params.id
      );
      const rawAlert = (allRawAlerts as Record<string, unknown>[]).find(
        (a) => a.id === params.id
      );

      const correctionEntry = {
        alert_id: params.id,
        original_priority: triageEntry?.priority ?? "UNKNOWN",
        corrected_priority: body.corrected_priority,
        analyst_note: body.analyst_note ?? "",
        alert_title: (rawAlert?.title ?? "") as string,
        alert_source: (rawAlert?.source ?? "") as string,
        hostname: (rawAlert?.hostname ?? "") as string,
        mitre_tactic: triageEntry?.mitre_tactic ?? "",
        timestamp: new Date().toISOString(),
      };

      let existingCorrections: unknown[] = [];
      try {
        const raw = await fs.readFile(correctionsPath, "utf-8");
        existingCorrections = JSON.parse(raw) as unknown[];
      } catch {
        // File doesn't exist yet — start with empty list.
      }

      // Replace any existing correction for the same alert_id, then append.
      const updatedCorrections = [
        ...(existingCorrections as Array<Record<string, unknown>>).filter(
          (c) => c.alert_id !== params.id
        ),
        correctionEntry,
      ];

      const correctionsTmp = correctionsPath + ".tmp";
      await fs.mkdir(path.dirname(correctionsPath), { recursive: true });
      await fs.writeFile(correctionsTmp, JSON.stringify(updatedCorrections, null, 2), "utf-8");
      await fs.rename(correctionsTmp, correctionsPath);
    } catch (err) {
      // Non-fatal: log but do not fail the feedback response.
      console.error("[feedback] Failed to write corrections.json:", err);
    }
  }

  return NextResponse.json({ success: true, feedback: entry });
}
