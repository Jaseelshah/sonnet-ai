"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { TriagedAlert } from "@/lib/types";
import { AlertsTable } from "@/components/AlertsTable";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<TriagedAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
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

  // Debounce: update debouncedSearch 300 ms after the user stops typing.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchAlerts = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
    if (tenant) params.set("tenant", tenant);

    try {
      const r = await fetch(`/api/alerts?${params}`);
      const data = await r.json();
      setAlerts(data.alerts ?? []);
      setError(false);
    } catch {
      if (initialLoad.current) setError(true);
    } finally {
      if (initialLoad.current) {
        setLoading(false);
        initialLoad.current = false;
      }
    }
  }, [debouncedSearch, priorityFilter, tenant]);

  // Reset initial-load flag whenever filters change so the spinner shows again
  useEffect(() => {
    initialLoad.current = true;
    setLoading(true);
    setError(false);
  }, [debouncedSearch, priorityFilter, tenant]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Alerts Feed</h1>
        <p className="text-sm text-gray-500 mt-1">
          {tenant ? `${tenant} — triaged alerts` : "All triaged security alerts"}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search by title or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00FFB2]/50"
        />
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-2 text-sm text-white focus:outline-none focus:border-[#00FFB2]/50"
        >
          <option value="ALL">All Priorities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="p-5 text-red-400">Failed to load alerts.</p>
        ) : (
          <AlertsTable alerts={alerts} />
        )}
      </div>
    </div>
  );
}
