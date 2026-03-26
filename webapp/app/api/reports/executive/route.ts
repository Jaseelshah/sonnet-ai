import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { readJSON, triageResultsPath, ROOT } from "@/lib/data";
import { ExecutiveReport } from "@/lib/types";

/** Path to analyst feedback log — defined locally until data.ts export is confirmed. */
const feedbackPath = path.join(ROOT, "logs", "feedback.json");

interface TriageRecord {
  alert_id: string;
  priority: string;
  confidence: number;
  summary: string;
  mitre_tactic: string;
  escalate: boolean;
  false_positive_likelihood: number;
  tenant_id?: string;
  triaged_at: string;
}

interface FeedbackRecord {
  alert_id: string;
  status: string;
}

/**
 * GET /api/reports/executive
 *
 * Aggregates triage results and analyst feedback into an executive summary.
 * Supports optional ?tenant= query param to filter by tenant_id.
 *
 * Returns: { report: ExecutiveReport }
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const tenant = request.nextUrl.searchParams.get("tenant") ?? "";

  try {
    // -------------------------------------------------------------------------
    // Load raw data
    // -------------------------------------------------------------------------
    const [allTriage, allFeedback] = await Promise.all([
      readJSON(triageResultsPath),
      readJSON(feedbackPath),
    ]);

    // -------------------------------------------------------------------------
    // Apply tenant filter
    // -------------------------------------------------------------------------
    const triage = (allTriage as TriageRecord[]).filter((tr) =>
      tenant ? tr.tenant_id === tenant : true
    );

    const feedback = allFeedback as FeedbackRecord[];

    // -------------------------------------------------------------------------
    // Guard: no data
    // -------------------------------------------------------------------------
    if (triage.length === 0) {
      const empty: ExecutiveReport = {
        generated_at: new Date().toISOString(),
        period: "Last 7 Days",
        total_alerts: 0,
        by_priority: {},
        top_tactics: [],
        average_confidence: 0,
        escalation_rate: 0,
        feedback_accuracy: 0,
        feedback_total: 0,
        feedback_confirmed: 0,
        feedback_corrected: 0,
        crown_jewel_escalations: 0,
        time_saved_hours: 0,
        alerts_per_day: 0,
      };
      return NextResponse.json({ report: empty });
    }

    // -------------------------------------------------------------------------
    // Aggregate triage data
    // -------------------------------------------------------------------------
    const byPriority: Record<string, number> = {};
    const tacticCounts: Record<string, number> = {};
    let totalConfidence = 0;
    let escalated = 0;
    let crownJewelEscalations = 0;
    const tenantCounts: Record<string, number> = {};
    const crownJewelRe = /crown\s+jewel/i;

    for (const tr of triage) {
      // Priority
      byPriority[tr.priority] = (byPriority[tr.priority] ?? 0) + 1;

      // MITRE tactic
      tacticCounts[tr.mitre_tactic] = (tacticCounts[tr.mitre_tactic] ?? 0) + 1;

      // Confidence accumulator
      totalConfidence += tr.confidence;

      // Escalation
      if (tr.escalate) escalated++;

      // Crown Jewel escalations
      if (crownJewelRe.test(tr.summary)) crownJewelEscalations++;

      // Tenant breakdown (only when not filtered to a single tenant)
      if (!tenant && tr.tenant_id) {
        tenantCounts[tr.tenant_id] = (tenantCounts[tr.tenant_id] ?? 0) + 1;
      }
    }

    const total = triage.length;
    const averageConfidence = totalConfidence / total;
    const escalationRate = escalated / total;

    // Top 5 tactics by count
    const topTactics = Object.entries(tacticCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tactic, count]) => ({ tactic, count }));

    // -------------------------------------------------------------------------
    // Aggregate feedback
    // -------------------------------------------------------------------------
    const feedbackTotal = feedback.length;
    let feedbackConfirmed = 0;
    let feedbackCorrected = 0;

    for (const fb of feedback) {
      if (fb.status === "confirmed") feedbackConfirmed++;
      else if (fb.status === "corrected") feedbackCorrected++;
    }

    const feedbackAccuracy =
      feedbackTotal > 0 ? feedbackConfirmed / feedbackTotal : 0;

    // -------------------------------------------------------------------------
    // Derived metrics
    // -------------------------------------------------------------------------
    const timeSavedHours = (total * 15) / 60;
    const alertsPerDay = total / 7;

    // Only include tenant_breakdown when there are multiple tenants observed
    const hasTenants = Object.keys(tenantCounts).length > 0;

    const report: ExecutiveReport = {
      generated_at: new Date().toISOString(),
      period: "Last 7 Days",
      total_alerts: total,
      by_priority: byPriority,
      top_tactics: topTactics,
      average_confidence: averageConfidence,
      escalation_rate: escalationRate,
      feedback_accuracy: feedbackAccuracy,
      feedback_total: feedbackTotal,
      feedback_confirmed: feedbackConfirmed,
      feedback_corrected: feedbackCorrected,
      crown_jewel_escalations: crownJewelEscalations,
      time_saved_hours: timeSavedHours,
      alerts_per_day: alertsPerDay,
      ...(hasTenants ? { tenant_breakdown: tenantCounts } : {}),
    };

    return NextResponse.json({ report });
  } catch (err) {
    console.error("[/api/reports/executive] Unexpected error:", err);
    return NextResponse.json(
      { error: "internal_error", message: "Failed to generate executive report." },
      { status: 500 }
    );
  }
}
