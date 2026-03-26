"use client";

import { useEffect, useState, useCallback } from "react";
import { ExecutiveReport } from "@/lib/types";

// ---------------------------------------------------------------------------
// Priority helpers
// ---------------------------------------------------------------------------
const PRIORITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#FF4444",
  HIGH: "#FF8C00",
  MEDIUM: "#FFD700",
  LOW: "#00FFB2",
};

const PRIORITY_PRINT_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#d97706",
  MEDIUM: "#b45309",
  LOW: "#059669",
};

// ---------------------------------------------------------------------------
// Inline SVG icons — no external deps needed for a printable page
// ---------------------------------------------------------------------------
function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25l7.5 3v6c0 4.556-3.075 8.608-7.5 9.75C7.575 19.858 4.5 15.806 4.5 11.25v-6L12 2.25z" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.056 48.056 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface KpiCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  accent?: boolean;
}

function KpiCard({ label, value, subtext, accent }: KpiCardProps) {
  return (
    <div
      className={[
        "relative rounded-xl border p-5 overflow-hidden print-card",
        accent
          ? "border-[#00FFB2]/20 bg-[#00FFB2]/5"
          : "border-gray-800 bg-gray-900/50",
      ].join(" ")}
    >
      {accent && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00FFB2]/40 to-transparent" />
      )}
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 print-subtext">
        {label}
      </p>
      <p
        className={[
          "mt-2 text-3xl font-bold tabular-nums print-text",
          accent ? "text-[#00FFB2]" : "text-white",
        ].join(" ")}
      >
        {value}
      </p>
      {subtext && (
        <p className="mt-1 text-xs text-gray-500 print-subtext">{subtext}</p>
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

function Section({ title, children }: SectionProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 print-card">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-4 print-subtext">
        {title}
      </h2>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ExecutiveReportPage() {
  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tenant, setTenant] = useState<string>("");

  // Sync tenant from localStorage on mount and listen for sidebar changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      setTenant(localStorage.getItem("sonnet-ai-tenant") ?? "");
    }

    function onTenantChanged(e: Event) {
      setTenant((e as CustomEvent<{ tenant: string }>).detail.tenant);
    }

    window.addEventListener("tenant-changed", onTenantChanged);
    return () => window.removeEventListener("tenant-changed", onTenantChanged);
  }, []);

  const fetchReport = useCallback(() => {
    const params = new URLSearchParams();
    if (tenant) params.set("tenant", tenant);

    setLoading(true);
    setError(false);

    fetch(`/api/reports/executive?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((body: { report: ExecutiveReport }) => setReport(body.report))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tenant]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // -------------------------------------------------------------------------
  // Loading / error states
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-red-400 p-6">
        Failed to load executive report. Ensure the Python triage agent has been run.
      </p>
    );
  }

  if (!report) return null;

  // -------------------------------------------------------------------------
  // Derived values for display
  // -------------------------------------------------------------------------
  const generatedDate = new Date(report.generated_at).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const tenantLabel = tenant || "All Clients";

  const maxPriorityCount = Math.max(
    ...PRIORITY_ORDER.map((p) => report.by_priority[p] ?? 0),
    1
  );

  const confidencePct = (report.average_confidence * 100).toFixed(1);
  const escalationPct = (report.escalation_rate * 100).toFixed(1);
  const accuracyPct = (report.feedback_accuracy * 100).toFixed(1);

  const hasTenantBreakdown =
    report.tenant_breakdown && Object.keys(report.tenant_breakdown).length > 0;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12" id="executive-report">

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start justify-between gap-4 print-card rounded-xl border border-gray-800 bg-gray-900/50 p-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#00FFB2]/10 text-[#00FFB2] flex-shrink-0">
            <ShieldIcon />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#00FFB2]">
              SONNET AI
            </p>
            <h1 className="text-2xl font-bold text-white print-text">
              Executive Security Summary
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <span className="text-sm text-gray-400 print-subtext">{report.period}</span>
              <span className="text-gray-700">|</span>
              <span className="text-sm text-gray-400 print-subtext">{tenantLabel}</span>
              <span className="text-gray-700">|</span>
              <span className="text-sm text-gray-500 print-subtext">Generated {generatedDate}</span>
            </div>
          </div>
        </div>

        {/* Download PDF — hidden in print via no-print class */}
        <button
          onClick={() => window.print()}
          className="no-print flex items-center gap-2 rounded-lg bg-[#00FFB2]/10 border border-[#00FFB2]/20 px-4 py-2 text-sm font-medium text-[#00FFB2] hover:bg-[#00FFB2]/20 transition-colors flex-shrink-0"
        >
          <PrintIcon />
          Download PDF
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* KPI row                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Alerts Triaged"
          value={report.total_alerts.toLocaleString()}
          subtext={report.period}
          accent
        />
        <KpiCard
          label="Time Saved"
          value={`${report.time_saved_hours.toFixed(1)}h`}
          subtext="at 15 min / alert"
        />
        <KpiCard
          label="AI Accuracy"
          value={`${accuracyPct}%`}
          subtext={
            report.feedback_total > 0
              ? `${report.feedback_total} reviews`
              : "Pending feedback"
          }
        />
        <KpiCard
          label="Crown Jewel Escalations"
          value={report.crown_jewel_escalations}
          subtext="High-value asset alerts"
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Priority breakdown + MITRE tactics (side by side on wide screens)   */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Priority breakdown — CSS bars, no recharts, prints cleanly */}
        <Section title="Alert Priority Breakdown">
          <div className="space-y-3">
            {PRIORITY_ORDER.map((priority) => {
              const count = report.by_priority[priority] ?? 0;
              const widthPct = Math.round((count / maxPriorityCount) * 100);
              const color = PRIORITY_COLORS[priority];
              const printColor = PRIORITY_PRINT_COLORS[priority];

              return (
                <div key={priority} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span
                      className="font-semibold print-text"
                      style={{ color }}
                    >
                      {priority}
                    </span>
                    <span className="text-gray-400 tabular-nums font-medium print-subtext">
                      {count}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-800 overflow-hidden priority-bar-track">
                    <div
                      className="h-full rounded-full priority-bar"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: color,
                        ["--print-color" as string]: printColor,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Top MITRE tactics */}
        <Section title="Top MITRE ATT&CK Tactics">
          {report.top_tactics.length === 0 ? (
            <p className="text-sm text-gray-500">No tactic data available.</p>
          ) : (
            <div className="space-y-2">
              {report.top_tactics.map((item, idx) => (
                <div
                  key={item.tactic}
                  className="flex items-center gap-3 py-2 border-b border-gray-800/60 last:border-0"
                >
                  <span className="text-xs font-bold text-gray-600 w-5 text-right tabular-nums">
                    {idx + 1}
                  </span>
                  <span className="flex-1 text-sm text-white truncate print-text">
                    {item.tactic}
                  </span>
                  <span className="flex-shrink-0 text-xs font-semibold text-[#00FFB2] bg-[#00FFB2]/10 rounded-full px-2.5 py-0.5 tabular-nums">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Operational metrics                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Section title="Operational Metrics">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500 print-subtext">
              Alerts / Day
            </p>
            <p className="mt-1 text-2xl font-bold text-white tabular-nums print-text">
              {report.alerts_per_day.toFixed(1)}
            </p>
            <p className="text-xs text-gray-600 print-subtext">7-day average</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500 print-subtext">
              Escalation Rate
            </p>
            <p className="mt-1 text-2xl font-bold text-white tabular-nums print-text">
              {escalationPct}%
            </p>
            <p className="text-xs text-gray-600 print-subtext">of total alerts</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500 print-subtext">
              Avg Confidence
            </p>
            <p className="mt-1 text-2xl font-bold text-[#00FFB2] tabular-nums">
              {confidencePct}%
            </p>
            <p className="text-xs text-gray-600 print-subtext">AI triage score</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500 print-subtext">
              Total Escalations
            </p>
            <p className="mt-1 text-2xl font-bold text-white tabular-nums print-text">
              {Math.round(report.total_alerts * report.escalation_rate)}
            </p>
            <p className="text-xs text-gray-600 print-subtext">analyst hand-offs</p>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Analyst feedback summary                                             */}
      {/* ------------------------------------------------------------------ */}
      <Section title="Analyst Feedback Summary">
        {report.feedback_total === 0 ? (
          <p className="text-sm text-gray-500 italic">
            No analyst feedback submitted yet. Feedback improves AI accuracy over time.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500 print-subtext">
                Total Reviewed
              </p>
              <p className="mt-1 text-2xl font-bold text-white tabular-nums print-text">
                {report.feedback_total}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500 print-subtext">
                Confirmed
              </p>
              <p className="mt-1 text-2xl font-bold text-[#00FFB2] tabular-nums">
                {report.feedback_confirmed}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500 print-subtext">
                Corrected
              </p>
              <p className="mt-1 text-2xl font-bold text-[#FF8C00] tabular-nums">
                {report.feedback_corrected}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-gray-500 print-subtext">
                Accuracy Rate
              </p>
              <p className="mt-1 text-2xl font-bold text-[#00FFB2] tabular-nums">
                {accuracyPct}%
              </p>
              <p className="text-xs text-gray-600 print-subtext">confirmed / total</p>
            </div>
          </div>
        )}
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* Tenant breakdown (only when multi-tenant data is present)           */}
      {/* ------------------------------------------------------------------ */}
      {hasTenantBreakdown && report.tenant_breakdown && (
        <Section title="Client Breakdown">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-800">
                <th className="pb-2 text-xs uppercase tracking-widest text-gray-500 font-semibold print-subtext">
                  Client / Tenant
                </th>
                <th className="pb-2 text-xs uppercase tracking-widest text-gray-500 font-semibold text-right print-subtext">
                  Alerts
                </th>
                <th className="pb-2 text-xs uppercase tracking-widest text-gray-500 font-semibold text-right print-subtext">
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.tenant_breakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([tid, count]) => (
                  <tr
                    key={tid}
                    className="border-b border-gray-800/50 last:border-0"
                  >
                    <td className="py-2.5 text-white font-medium print-text">{tid}</td>
                    <td className="py-2.5 text-right text-gray-300 tabular-nums print-text">
                      {count}
                    </td>
                    <td className="py-2.5 text-right text-gray-500 tabular-nums print-subtext">
                      {((count / report.total_alerts) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="text-center py-4 border-t border-gray-800">
        <p className="text-xs text-gray-600 print-subtext">
          Generated by Sonnet AI — Autonomous SOC Triage Platform
        </p>
        <p className="text-xs text-gray-700 mt-0.5 print-subtext">{report.generated_at}</p>
      </div>
    </div>
  );
}
