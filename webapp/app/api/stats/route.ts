import { NextResponse } from "next/server";
import { readJSON, triageResultsPath, rawAlertsPath } from "@/lib/data";

export async function GET() {
  const triageResults = await readJSON(triageResultsPath);
  const rawAlerts = await readJSON(rawAlertsPath);

  if (triageResults.length === 0) {
    return NextResponse.json({
      total_alerts: 0,
      by_priority: {},
      average_confidence: 0,
      escalation_rate: 0,
      by_mitre_tactic: {},
      by_mitre_technique: {},
      recent_alerts: [],
      false_positive_avg: 0,
    });
  }

  const alertMap = new Map<string, Record<string, unknown>>();
  for (const a of rawAlerts as Record<string, unknown>[]) {
    alertMap.set(a.id as string, a);
  }

  const byPriority: Record<string, number> = {};
  const byTactic: Record<string, number> = {};
  const byTechnique: Record<string, number> = {};
  let totalConfidence = 0;
  let totalFP = 0;
  let escalated = 0;

  for (const tr of triageResults as Record<string, unknown>[]) {
    byPriority[tr.priority as string] = (byPriority[tr.priority as string] ?? 0) + 1;
    byTactic[tr.mitre_tactic as string] = (byTactic[tr.mitre_tactic as string] ?? 0) + 1;
    byTechnique[tr.mitre_technique as string] = (byTechnique[tr.mitre_technique as string] ?? 0) + 1;
    totalConfidence += tr.confidence as number;
    totalFP += tr.false_positive_likelihood as number;
    if (tr.escalate) escalated++;
  }

  const merged = (triageResults as Record<string, unknown>[]).map((tr) => ({
    ...(alertMap.get(tr.alert_id as string) ?? {}),
    ...tr,
  }));

  merged.sort(
    (a: Record<string, unknown>, b: Record<string, unknown>) =>
      new Date(b.triaged_at as string).getTime() - new Date(a.triaged_at as string).getTime()
  );

  return NextResponse.json({
    total_alerts: triageResults.length,
    by_priority: byPriority,
    average_confidence: totalConfidence / triageResults.length,
    escalation_rate: escalated / triageResults.length,
    by_mitre_tactic: byTactic,
    by_mitre_technique: byTechnique,
    recent_alerts: merged.slice(0, 5),
    false_positive_avg: totalFP / triageResults.length,
  });
}
