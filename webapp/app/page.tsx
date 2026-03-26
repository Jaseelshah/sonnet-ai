"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { StatCard } from "@/components/StatCard";
import { AlertsTable } from "@/components/AlertsTable";
import { DashboardStats } from "@/lib/types";

const PIE_COLORS = ["#FF4444", "#FF8C00", "#FFD700", "#00FFB2", "#6366f1", "#8b5cf6", "#ec4899"];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tenant, setTenant] = useState<string>("");
  const initialLoad = useRef(true);

  // Sync tenant from localStorage on mount and listen for sidebar changes
  useEffect(() => {
    setTenant(localStorage.getItem("sonnet-ai-tenant") ?? "");

    function onTenantChanged(e: Event) {
      setTenant((e as CustomEvent<{ tenant: string }>).detail.tenant);
    }

    window.addEventListener("tenant-changed", onTenantChanged);
    return () => window.removeEventListener("tenant-changed", onTenantChanged);
  }, []);

  const fetchStats = useCallback(async () => {
    const params = new URLSearchParams();
    if (tenant) params.set("tenant", tenant);

    try {
      const r = await fetch(`/api/stats?${params}`);
      const data = await r.json();
      setStats(data);
      setError(false);
    } catch {
      if (initialLoad.current) setError(true);
    } finally {
      if (initialLoad.current) {
        setLoading(false);
        initialLoad.current = false;
      }
    }
  }, [tenant]);

  // Reset loading state when tenant changes so spinner shows
  useEffect(() => {
    initialLoad.current = true;
    setLoading(true);
    setError(false);
  }, [tenant]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) return <p className="text-red-400">Failed to load dashboard data. Check that the Python agent has been run.</p>;

  if (!stats) return <p className="text-gray-500">Failed to load dashboard data.</p>;

  const priorityData = Object.entries(stats.by_priority).map(([name, value]) => ({
    name,
    value,
  }));

  const tacticData = Object.entries(stats.by_mitre_tactic).map(([name, value]) => ({
    name,
    value,
  }));

  const priorityColorMap: Record<string, string> = {
    CRITICAL: "#FF4444",
    HIGH: "#FF8C00",
    MEDIUM: "#FFD700",
    LOW: "#00FFB2",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          {tenant ? `${tenant} — triage overview` : "Sonnet AI triage overview"}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Alerts" value={stats.total_alerts} accent />
        <StatCard
          label="Critical"
          value={stats.by_priority.CRITICAL ?? 0}
          subtext="Requires immediate action"
        />
        <StatCard
          label="Avg Confidence"
          value={`${(stats.average_confidence * 100).toFixed(0)}%`}
        />
        <StatCard
          label="Escalation Rate"
          value={`${(stats.escalation_rate * 100).toFixed(0)}%`}
        />
        <StatCard
          label="Feedback Coverage"
          value={`${((stats.feedback_coverage ?? 0) * 100).toFixed(0)}%`}
          subtext="Analyst-reviewed alerts"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Priority bar chart */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Alerts by Priority</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={priorityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 12 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #1f2937", borderRadius: "8px" }}
                labelStyle={{ color: "#fff" }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {priorityData.map((entry) => (
                  <Cell key={entry.name} fill={priorityColorMap[entry.name] ?? "#6366f1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* MITRE tactic pie chart */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h2 className="text-sm font-semibold text-white mb-4">MITRE ATT&CK Tactics</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={tacticData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
              >
                {tacticData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #1f2937", borderRadius: "8px" }}
                labelStyle={{ color: "#fff" }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2">
            {tacticData.map((t, i) => (
              <div key={t.name} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                {t.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent alerts */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Recent Alerts</h2>
        <AlertsTable alerts={stats.recent_alerts} compact />
      </div>
    </div>
  );
}
