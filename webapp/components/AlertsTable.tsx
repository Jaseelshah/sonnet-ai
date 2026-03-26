"use client";

import Link from "next/link";
import { TriagedAlert, AlertFeedback } from "@/lib/types";
import { PriorityBadge } from "./PriorityBadge";
import { FeedbackBadge } from "./FeedbackBadge";

export interface AlertsTableProps {
  alerts: TriagedAlert[];
  compact?: boolean;
  feedbackMap?: Record<string, AlertFeedback>;
}

export function AlertsTable({
  alerts,
  compact = false,
  feedbackMap,
}: AlertsTableProps) {
  // Column count for empty-state colspan
  // compact: 4 cols (ID, Title, Priority, Confidence, Time)
  // full:    7 cols (+ MITRE Technique, Escalated, Review)
  const colCount = compact ? 5 : 8;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-left">
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
              Alert ID
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
              Title
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
              Priority
            </th>
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
              Confidence
            </th>
            {!compact && (
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                MITRE Technique
              </th>
            )}
            {!compact && (
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Escalated
              </th>
            )}
            {!compact && (
              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Review
              </th>
            )}
            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
              Time
            </th>
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert) => (
            <tr
              key={alert.alert_id}
              className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/alerts/${alert.alert_id}`}
                  className="text-[#00FFB2] hover:underline font-mono text-xs"
                >
                  {alert.alert_id}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-300 max-w-xs truncate">
                {alert.title}
              </td>
              <td className="px-4 py-3">
                <PriorityBadge priority={alert.priority} size="sm" />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00FFB2] rounded-full"
                      style={{ width: `${alert.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 tabular-nums">
                    {(alert.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </td>
              {!compact && (
                <td className="px-4 py-3 text-xs text-gray-400">
                  {alert.mitre_technique}
                </td>
              )}
              {!compact && (
                <td className="px-4 py-3">
                  {alert.escalate ? (
                    <span className="text-[#FF4444] text-xs font-medium">Yes</span>
                  ) : (
                    <span className="text-gray-600 text-xs">No</span>
                  )}
                </td>
              )}
              {!compact && (
                <td className="px-4 py-3">
                  <FeedbackBadge
                    status={feedbackMap?.[alert.alert_id]?.status}
                  />
                </td>
              )}
              <td className="px-4 py-3 text-xs text-gray-500">
                {new Date(alert.triaged_at)
                  .toISOString()
                  .replace("T", " ")
                  .slice(0, 19) + " UTC"}
              </td>
            </tr>
          ))}
          {alerts.length === 0 && (
            <tr>
              <td
                colSpan={colCount}
                className="px-4 py-8 text-center text-gray-600"
              >
                No alerts found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
