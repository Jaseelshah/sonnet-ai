import { NextRequest, NextResponse } from "next/server";
import { readJSON, triageResultsPath, rawAlertsPath } from "@/lib/data";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const priority = searchParams.get("priority");
  const search = searchParams.get("search")?.toLowerCase();

  const triageResults = await readJSON(triageResultsPath);
  const rawAlerts = await readJSON(rawAlertsPath);

  const alertMap = new Map<string, Record<string, unknown>>();
  for (const a of rawAlerts as Record<string, unknown>[]) {
    alertMap.set(a.id as string, a);
  }

  let alerts = (triageResults as Record<string, unknown>[]).map((tr) => {
    const raw = alertMap.get(tr.alert_id as string) ?? {};
    return { ...raw, ...tr };
  });

  if (priority) {
    alerts = alerts.filter((a) => a.priority === priority);
  }
  if (search) {
    alerts = alerts.filter(
      (a) =>
        (a.title as string)?.toLowerCase().includes(search) ||
        (a.alert_id as string)?.toLowerCase().includes(search) ||
        (a.description as string)?.toLowerCase().includes(search)
    );
  }

  alerts.sort(
    (a, b) =>
      new Date(b.triaged_at as string).getTime() - new Date(a.triaged_at as string).getTime()
  );

  return NextResponse.json({ alerts, total: alerts.length });
}
