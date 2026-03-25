"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { TriagedAlert } from "@/lib/types";
import { PriorityBadge } from "@/components/PriorityBadge";

export default function AlertDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [alert, setAlert] = useState<TriagedAlert | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    fetch(`/api/alerts/${id}`)
      .then((r) => r.json())
      .then((data) => setAlert(data.alert ?? null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

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
    <div className="space-y-6 max-w-4xl">
      <Link href="/alerts" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-[#00FFB2] transition-colors">
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
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Summary</h2>
        <p className="text-sm text-gray-300 leading-relaxed">{alert.summary}</p>
      </div>

      {/* Priority & Confidence */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Confidence</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-[#00FFB2] rounded-full" style={{ width: `${alert.confidence * 100}%` }} />
            </div>
            <span className="text-lg font-bold text-white tabular-nums">{(alert.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">False Positive Likelihood</h3>
          <span className="text-lg font-bold text-white">{(alert.false_positive_likelihood * 100).toFixed(0)}%</span>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Escalated</h3>
          <span className={`text-lg font-bold ${alert.escalate ? "text-[#FF4444]" : "text-gray-600"}`}>
            {alert.escalate ? "Yes" : "No"}
          </span>
        </div>
      </div>

      {/* MITRE ATT&CK */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">MITRE ATT&CK Mapping</h2>
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
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Recommended Actions</h2>
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

      {/* Alert Details */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Alert Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-500">Source: </span><span className="text-gray-300">{alert.source}</span></div>
          <div><span className="text-gray-500">Severity: </span><span className="text-gray-300">{alert.severity}</span></div>
          {alert.source_ip && <div><span className="text-gray-500">Source IP: </span><span className="text-gray-300 font-mono">{alert.source_ip}</span></div>}
          {alert.dest_ip && <div><span className="text-gray-500">Dest IP: </span><span className="text-gray-300 font-mono">{alert.dest_ip}</span></div>}
          {alert.user && <div><span className="text-gray-500">User: </span><span className="text-gray-300">{alert.user}</span></div>}
          {alert.hostname && <div><span className="text-gray-500">Hostname: </span><span className="text-gray-300 font-mono">{alert.hostname}</span></div>}
        </div>
      </div>

      {/* Raw data */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-xs font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-400 flex items-center gap-2"
        >
          Raw Alert Data
          <svg viewBox="0 0 16 16" fill="currentColor" className={`w-3 h-3 transition-transform ${showRaw ? "rotate-180" : ""}`}>
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
  );
}
