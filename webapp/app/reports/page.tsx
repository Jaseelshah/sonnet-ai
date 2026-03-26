"use client";

import { useEffect, useState, useCallback } from "react";
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
import { DashboardStats } from "@/lib/types";

const COLORS = ["#FF4444", "#FF8C00", "#FFD700", "#00FFB2", "#6366f1", "#8b5cf6"];

export default function ReportsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tenant, setTenant] = useState<string>("");

  // Sync tenant from localStorage on mount and listen for sidebar changes
  useEffect(() => {
    setTenant(localStorage.getItem("sonnet-ai-tenant") ?? "");

    function onTenantChanged(e: Event) {
      setTenant((e as CustomEvent<{ tenant: string }>).detail.tenant);
    }

    window.addEventListener("tenant-changed", onTenantChanged);
    return () => window.removeEventListener("tenant-changed", onTenantChanged);
  }, []);

  const fetchStats = useCallback(() => {
    const params = new URLSearchParams();
    if (tenant) params.set("tenant", tenant);

    setLoading(true);
    setError(false);
    fetch(`/api/stats?${params}`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tenant]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) return <p className="text-red-400">Failed to load report data. Check that the Python agent has been run.</p>;

  if (!stats) return <p className="text-gray-500">Failed to load report data.</p>;

  const priorityData = Object.entries(stats.by_priority).map(([name, value]) => ({ name, value }));
  const techniqueData = Object.entries(stats.by_mitre_technique).map(([name, value]) => ({ name: name.length > 25 ? name.slice(0, 25) + "..." : name, value }));
  const tacticData = Object.entries(stats.by_mitre_tactic).map(([name, value]) => ({ name, value }));

  const priorityColors: Record<string, string> = {
    CRITICAL: "#FF4444",
    HIGH: "#FF8C00",
    MEDIUM: "#FFD700",
    LOW: "#00FFB2",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tenant ? `${tenant} — analytics and insights` : "Triage analytics and insights"}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Alerts" value={stats.total_alerts} accent />
        <StatCard label="Avg Confidence" value={`${(stats.average_confidence * 100).toFixed(0)}%`} />
        <StatCard label="Escalation Rate" value={`${(stats.escalation_rate * 100).toFixed(0)}%`} />
        <StatCard label="Avg FP Likelihood" value={`${(stats.false_positive_avg * 100).toFixed(0)}%`} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Priority distribution */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Priority Distribution</h2>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={priorityData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value">
                {priorityData.map((entry) => (
                  <Cell key={entry.name} fill={priorityColors[entry.name] ?? "#6366f1"} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #1f2937", borderRadius: "8px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {priorityData.map((entry) => (
              <div key={entry.name} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: priorityColors[entry.name] }} />
                {entry.name}: {entry.value}
              </div>
            ))}
          </div>
        </div>

        {/* MITRE tactic bar chart */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h2 className="text-sm font-semibold text-white mb-4">MITRE ATT&CK Tactics</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={tacticData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#9ca3af", fontSize: 11 }} width={120} />
              <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #1f2937", borderRadius: "8px" }} />
              <Bar dataKey="value" fill="#00FFB2" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Technique breakdown */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">MITRE Techniques Breakdown</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={techniqueData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="name" tick={{ fill: "#9ca3af", fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
            <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} allowDecimals={false} />
            <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #1f2937", borderRadius: "8px" }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {techniqueData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
