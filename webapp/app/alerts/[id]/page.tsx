"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TriagedAlert, AlertFeedback, Priority, ResponseActionEntry } from "@/lib/types";
import { PriorityBadge } from "@/components/PriorityBadge";
import { cn, PRIORITY_BG_CLASSES } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Correction modal
// ---------------------------------------------------------------------------

interface CorrectionModalProps {
  currentPriority: Priority;
  onSubmit: (priority: Priority, note: string) => void;
  onCancel: () => void;
  submitting: boolean;
}

const PRIORITIES: Priority[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const PRIORITY_LABELS: Record<Priority, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

function CorrectionModal({
  currentPriority,
  onSubmit,
  onCancel,
  submitting,
}: CorrectionModalProps) {
  const [selected, setSelected] = useState<Priority>(currentPriority);
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-white mb-1">Correct Verdict</h2>
        <p className="text-xs text-gray-500 mb-5">
          Override the AI-assigned priority and leave an optional analyst note.
        </p>

        {/* Priority selector */}
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
            Corrected Priority
          </p>
          <div className="grid grid-cols-2 gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setSelected(p)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-all",
                  PRIORITY_BG_CLASSES[p],
                  selected === p
                    ? "ring-2 ring-offset-2 ring-offset-gray-900 ring-white/40"
                    : "opacity-50 hover:opacity-80"
                )}
              >
                {PRIORITY_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* Analyst note */}
        <div className="mb-6">
          <label
            htmlFor="analyst-note"
            className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2 block"
          >
            Analyst Note <span className="normal-case font-normal">(optional)</span>
          </label>
          <textarea
            id="analyst-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Known benign scanner, FP from endpoint telemetry..."
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#00FFB2]/50 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onSubmit(selected, note)}
            disabled={submitting}
            className="flex-1 rounded-lg bg-[#00FFB2] px-4 py-2 text-xs font-semibold text-gray-950 hover:bg-[#00FFB2]/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Submitting..." : "Submit Correction"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-lg border border-gray-700 px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white hover:border-gray-600 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feedback status banner
// ---------------------------------------------------------------------------

interface FeedbackBannerProps {
  feedback: AlertFeedback;
}

function FeedbackBanner({ feedback }: FeedbackBannerProps) {
  const isConfirmed = feedback.status === "confirmed";
  const ts = new Date(feedback.reviewed_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <div
      className={cn(
        "rounded-xl border bg-gray-900/50 p-5 border-l-4",
        isConfirmed
          ? "border-green-500/30 border-l-green-500"
          : "border-amber-500/30 border-l-amber-500"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className={cn(
              "text-sm font-semibold",
              isConfirmed ? "text-green-400" : "text-amber-400"
            )}
          >
            {isConfirmed ? "Analyst Confirmed" : "Analyst Corrected"}
          </p>
          {!isConfirmed && feedback.corrected_priority && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-gray-500">Corrected to</span>
              <PriorityBadge priority={feedback.corrected_priority} size="sm" />
            </div>
          )}
          {feedback.analyst_note && (
            <p className="text-xs text-gray-400 mt-2 italic">
              &ldquo;{feedback.analyst_note}&rdquo;
            </p>
          )}
        </div>
        <p className="text-xs text-gray-600 whitespace-nowrap">{ts}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AlertDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [alert, setAlert] = useState<TriagedAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  // Feedback state
  const [feedback, setFeedback] = useState<AlertFeedback | null>(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Response actions state
  const [responseActions, setResponseActions] = useState<ResponseActionEntry[]>([]);
  const [respondingAction, setRespondingAction] = useState<string | null>(null);

  // Fetch alert data
  useEffect(() => {
    fetch(`/api/alerts/${id}`)
      .then((r) => r.json())
      .then((data) => setAlert(data.alert ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  // Fetch existing feedback for this alert
  useEffect(() => {
    fetch(`/api/alerts/${id}/feedback`)
      .then((r) => r.json())
      .then((data) => setFeedback(data.feedback ?? null))
      .catch(console.error);
  }, [id]);

  // Fetch existing response actions for this alert
  useEffect(() => {
    fetch(`/api/alerts/${id}/respond`)
      .then((r) => r.json())
      .then((data) => setResponseActions(data.actions ?? []))
      .catch(console.error);
  }, [id]);

  async function triggerResponseAction(action: string) {
    setRespondingAction(action);
    try {
      const r = await fetch(`/api/alerts/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await r.json();
      if (data.success) {
        setResponseActions((prev) => [...prev, data.action]);
      }
    } catch (err) {
      console.error("Failed to trigger response action", err);
    } finally {
      setRespondingAction(null);
    }
  }

  function relativeTime(timestamp: string): string {
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  const ACTION_LABELS: Record<string, string> = {
    isolate_host: "Isolate Host",
    block_ip: "Block IP",
    reset_password: "Reset Credentials",
    dismiss: "Dismiss Alert",
  };

  const ACTION_ICONS: Record<string, string> = {
    isolate_host: "🔒",
    block_ip: "🛡️",
    reset_password: "🔑",
    dismiss: "✕",
  };

  async function submitFeedback(
    status: "confirmed" | "corrected",
    corrected_priority?: Priority,
    analyst_note?: string
  ) {
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { status };
      if (corrected_priority) body.corrected_priority = corrected_priority;
      if (analyst_note) body.analyst_note = analyst_note;

      const r = await fetch(`/api/alerts/${id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (data.success) {
        setFeedback(data.feedback);
        setShowCorrectionModal(false);
      }
    } catch (err) {
      console.error("Failed to submit feedback", err);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Alert not found.</p>
        <Link href="/alerts" className="text-[#00FFB2] text-sm hover:underline mt-2 inline-block">
          Back to alerts
        </Link>
      </div>
    );
  }

  return (
    <>
      {showCorrectionModal && (
        <CorrectionModal
          currentPriority={alert.priority}
          onSubmit={(priority, note) =>
            submitFeedback("corrected", priority, note)
          }
          onCancel={() => setShowCorrectionModal(false)}
          submitting={submitting}
        />
      )}

      <div className="space-y-6 max-w-4xl">
        <Link
          href="/alerts"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#00FFB2] transition-colors"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
          Back to Alerts
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{alert.title}</h1>
            <p className="text-sm text-gray-500 mt-1 font-mono">{alert.alert_id}</p>
          </div>
          <PriorityBadge priority={alert.priority} />
        </div>

        {/* Summary */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Summary
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed">{alert.summary}</p>
        </div>

        {/* Analyst Feedback */}
        {feedback ? (
          <FeedbackBanner feedback={feedback} />
        ) : (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
              Analyst Review
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              Confirm the AI verdict or correct it with your assessment.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => submitFeedback("confirmed")}
                disabled={submitting}
                aria-label="Confirm AI verdict"
                className="inline-flex items-center gap-2 rounded-lg border border-green-500/40 px-4 py-2 text-xs font-semibold text-green-400 hover:bg-green-500/10 disabled:opacity-50 transition-colors"
              >
                {/* checkmark icon */}
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                  <path
                    d="M3 8l3.5 3.5L13 5"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Confirm Verdict
              </button>
              <button
                type="button"
                onClick={() => setShowCorrectionModal(true)}
                disabled={submitting}
                aria-label="Correct AI verdict"
                className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 px-4 py-2 text-xs font-semibold text-amber-400 hover:bg-amber-500/10 disabled:opacity-50 transition-colors"
              >
                {/* x icon */}
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                  <path
                    d="M4 4l8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                  />
                </svg>
                Correct Verdict
              </button>
            </div>
          </div>
        )}

        {/* Priority & Confidence */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Confidence
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00FFB2] rounded-full"
                  style={{ width: `${alert.confidence * 100}%` }}
                />
              </div>
              <span className="text-lg font-bold text-white tabular-nums">
                {(alert.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              False Positive Likelihood
            </h3>
            <span className="text-lg font-bold text-white">
              {(alert.false_positive_likelihood * 100).toFixed(0)}%
            </span>
          </div>
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Escalated
            </h3>
            <span
              className={`text-lg font-bold ${
                alert.escalate ? "text-[#FF4444]" : "text-gray-600"
              }`}
            >
              {alert.escalate ? "Yes" : "No"}
            </span>
          </div>
        </div>

        {/* MITRE ATT&CK */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            MITRE ATT&CK Mapping
          </h2>
          <div className="flex gap-6">
            <div>
              <p className="text-xs text-gray-500">Tactic</p>
              <p className="text-sm text-white font-medium mt-1">{alert.mitre_tactic}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Technique</p>
              <p className="text-sm text-white font-medium mt-1">{alert.mitre_technique}</p>
            </div>
          </div>
        </div>

        {/* Recommended Actions */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Recommended Actions
          </h2>
          <ul className="space-y-2">
            {alert.recommended_actions.map((action, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                <span className="mt-1 w-4 h-4 rounded border border-gray-700 flex-shrink-0 flex items-center justify-center text-[10px] text-gray-600">
                  {i + 1}
                </span>
                {action}
              </li>
            ))}
          </ul>
        </div>

        {/* Response Actions */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Response Actions
          </h2>

          {/* Simulation mode banner */}
          <div className="text-xs text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 mb-4">
            ⚠ Response actions are in simulation mode — connect your EDR/firewall APIs to enable live response
          </div>

          {/* Action buttons — 2x2 grid */}
          <div className="grid grid-cols-2 gap-3">
            {(["isolate_host", "block_ip", "reset_password", "dismiss"] as const).map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => triggerResponseAction(action)}
                disabled={respondingAction !== null}
                className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-300 hover:border-gray-600 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {respondingAction === action ? (
                  <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                ) : (
                  <span className="flex-shrink-0">{ACTION_ICONS[action]}</span>
                )}
                {ACTION_LABELS[action]}
              </button>
            ))}
          </div>

          {/* Action history */}
          {responseActions.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
                Action History
              </p>
              <div className="relative border-l border-gray-700 pl-4 space-y-3">
                {[...responseActions].reverse().map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 text-xs">
                    <span className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-gray-700 border border-gray-600" />
                    <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-amber-400 font-medium capitalize">
                      {entry.status}
                    </span>
                    <span className="text-gray-300">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                    <span className="text-gray-600">&middot;</span>
                    <span className="text-gray-500">{relativeTime(entry.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Alert Details */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Alert Details
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Source: </span>
              <span className="text-gray-300">{alert.source}</span>
            </div>
            <div>
              <span className="text-gray-500">Severity: </span>
              <span className="text-gray-300">{alert.severity}</span>
            </div>
            {alert.source_ip && (
              <div>
                <span className="text-gray-500">Source IP: </span>
                <span className="text-gray-300 font-mono">{alert.source_ip}</span>
              </div>
            )}
            {alert.dest_ip && (
              <div>
                <span className="text-gray-500">Dest IP: </span>
                <span className="text-gray-300 font-mono">{alert.dest_ip}</span>
              </div>
            )}
            {alert.user && (
              <div>
                <span className="text-gray-500">User: </span>
                <span className="text-gray-300">{alert.user}</span>
              </div>
            )}
            {alert.hostname && (
              <div>
                <span className="text-gray-500">Hostname: </span>
                <span className="text-gray-300 font-mono">{alert.hostname}</span>
              </div>
            )}
          </div>
        </div>

        {/* Raw data */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="text-xs font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-400 flex items-center gap-2"
          >
            Raw Alert Data
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              className={`w-3 h-3 transition-transform ${showRaw ? "rotate-180" : ""}`}
            >
              <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
          {showRaw && (
            <pre className="mt-3 text-xs text-gray-400 bg-gray-900 rounded-lg p-4 overflow-x-auto">
              {JSON.stringify(alert, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </>
  );
}
