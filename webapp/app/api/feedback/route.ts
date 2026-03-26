import { NextResponse } from "next/server";
import { readJSON, feedbackPath } from "@/lib/data";
import { AlertFeedback } from "@/lib/types";

// ---------------------------------------------------------------------------
// GET /api/feedback
// Returns all feedback entries as a map keyed by alert_id.
// Used by the alerts table for efficient per-row status lookup.
// ---------------------------------------------------------------------------
export async function GET() {
  const allFeedback = (await readJSON(feedbackPath)) as AlertFeedback[];

  const feedbackMap: Record<string, AlertFeedback> = {};
  for (const entry of allFeedback) {
    feedbackMap[entry.alert_id] = entry;
  }

  return NextResponse.json({ feedback: feedbackMap });
}
