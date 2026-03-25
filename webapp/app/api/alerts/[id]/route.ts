import { NextRequest, NextResponse } from "next/server";
import { readJSON, triageResultsPath, rawAlertsPath } from "@/lib/data";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const triageResults = await readJSON(triageResultsPath);
  const rawAlerts = await readJSON(rawAlertsPath);

  const triage = (triageResults as Record<string, unknown>[]).find(
    (t) => t.alert_id === id
  );
  if (!triage) {
    return NextResponse.json({ error: "Alert not found" }, { status: 404 });
  }

  const raw =
    (rawAlerts as Record<string, unknown>[]).find((a) => a.id === id) ?? {};
  const alert = { ...raw, ...triage };

  return NextResponse.json({ alert });
}
