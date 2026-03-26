"use client";

import { useEffect, useState } from "react";
import { Settings } from "@/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings(data.settings ?? null))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setToast("Settings saved successfully");
        setTimeout(() => setToast(null), 3000);
      }
    } catch {
      setToast("Failed to save settings");
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#00FFB2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) return <p className="text-red-400">Failed to load settings. Check that the Python agent has been run.</p>;

  if (!settings) return <p className="text-gray-500">Failed to load settings.</p>;

  const inputClass =
    "w-full rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#00FFB2]/50";
  const labelClass = "block text-xs font-medium text-gray-400 mb-1.5";
  const sectionClass = "rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure Sonnet AI integrations</p>
      </div>

      {/* Restart notice */}
      <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-4 py-3">
        <p className="text-xs text-yellow-400">
          Changes to API keys, model, and integration settings require restarting the Python agent (<code className="bg-gray-800 px-1 py-0.5 rounded text-yellow-300">python main.py</code>) to take effect. UI settings like log level apply on next triage run.
        </p>
      </div>

      {/* Anthropic */}
      <div className={sectionClass}>
        <h2 className="text-sm font-semibold text-white">Anthropic API</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Model</label>
            <input
              className={inputClass}
              value={settings.anthropic.model}
              onChange={(e) => setSettings({ ...settings, anthropic: { ...settings.anthropic, model: e.target.value } })}
            />
          </div>
          <div>
            <label className={labelClass}>Max Tokens</label>
            <input
              type="number"
              className={inputClass}
              value={settings.anthropic.max_tokens}
              onChange={(e) => setSettings({ ...settings, anthropic: { ...settings.anthropic, max_tokens: parseInt(e.target.value) || 1024 } })}
            />
          </div>
        </div>
      </div>

      {/* Slack */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Slack Integration</h2>
          <button
            onClick={() => setSettings({ ...settings, slack: { ...settings.slack, enabled: !settings.slack.enabled } })}
            className={`relative w-10 h-5 rounded-full transition-colors ${settings.slack.enabled ? "bg-[#00FFB2]" : "bg-gray-700"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.slack.enabled ? "translate-x-5" : ""}`} />
          </button>
        </div>
        {settings.slack.enabled && (
          <div>
            <label className={labelClass}>Webhook URL</label>
            <input
              className={inputClass}
              value={settings.slack.webhook_url}
              onChange={(e) => setSettings({ ...settings, slack: { ...settings.slack, webhook_url: e.target.value } })}
              placeholder="https://hooks.slack.com/services/..."
            />
          </div>
        )}
      </div>

      {/* Jira */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Jira Integration</h2>
          <button
            onClick={() => setSettings({ ...settings, jira: { ...settings.jira, enabled: !settings.jira.enabled } })}
            className={`relative w-10 h-5 rounded-full transition-colors ${settings.jira.enabled ? "bg-[#00FFB2]" : "bg-gray-700"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.jira.enabled ? "translate-x-5" : ""}`} />
          </button>
        </div>
        {settings.jira.enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Jira URL</label>
              <input className={inputClass} value={settings.jira.url} onChange={(e) => setSettings({ ...settings, jira: { ...settings.jira, url: e.target.value } })} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input className={inputClass} value={settings.jira.email} onChange={(e) => setSettings({ ...settings, jira: { ...settings.jira, email: e.target.value } })} />
            </div>
            <div>
              <label className={labelClass}>Project Key</label>
              <input className={inputClass} value={settings.jira.project_key} onChange={(e) => setSettings({ ...settings, jira: { ...settings.jira, project_key: e.target.value } })} />
            </div>
          </div>
        )}
      </div>

      {/* VirusTotal */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">VirusTotal Enrichment</h2>
          <button
            onClick={() => setSettings({ ...settings, virustotal: { ...settings.virustotal, enabled: !settings.virustotal.enabled } })}
            className={`relative w-10 h-5 rounded-full transition-colors ${settings.virustotal.enabled ? "bg-[#00FFB2]" : "bg-gray-700"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.virustotal.enabled ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </div>

      {/* Triage Tuning */}
      <div className={sectionClass}>
        <h2 className="text-sm font-semibold text-white">Triage Tuning</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>False Positive Threshold: {settings.triage.false_positive_threshold}</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.triage.false_positive_threshold}
              onChange={(e) => setSettings({ ...settings, triage: { ...settings.triage, false_positive_threshold: parseFloat(e.target.value) } })}
              className="w-full accent-[#00FFB2]"
            />
          </div>
          <div>
            <label className={labelClass}>Log Level</label>
            <select
              className={inputClass}
              value={settings.triage.log_level}
              onChange={(e) => setSettings({ ...settings, triage: { ...settings.triage, log_level: e.target.value } })}
            >
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
            </select>
          </div>
        </div>
      </div>

      {/* Autonomous Response */}
      <div className={sectionClass}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Autonomous Response</h2>
          <button
            onClick={() => setSettings({ ...settings, autonomy: { ...settings.autonomy, enabled: !settings.autonomy.enabled } })}
            className={`relative w-10 h-5 rounded-full transition-colors ${settings.autonomy.enabled ? "bg-[#00FFB2]" : "bg-gray-700"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${settings.autonomy.enabled ? "translate-x-5" : ""}`} />
          </button>
        </div>
        <p className="text-xs text-gray-500">
          When enabled, high-confidence CRITICAL alerts will trigger response actions automatically without analyst confirmation.
        </p>
        <div>
          <label className={labelClass}>Autonomy Threshold: {settings.autonomy.threshold}</label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            className={inputClass}
            value={settings.autonomy.threshold}
            onChange={(e) => setSettings({ ...settings, autonomy: { ...settings.autonomy, threshold: parseFloat(e.target.value) || 0.95 } })}
          />
        </div>
      </div>

      {/* Save */}
      <button
        onClick={save}
        disabled={saving}
        className="px-6 py-2.5 rounded-lg bg-[#00FFB2] text-[#07090F] font-semibold text-sm hover:bg-[#00FFB2]/90 disabled:opacity-50 transition-colors"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
