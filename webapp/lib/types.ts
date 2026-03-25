export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Alert {
  id: string;
  source: string;
  timestamp: string;
  severity: string;
  title: string;
  description: string;
  source_ip?: string;
  dest_ip?: string;
  user?: string;
  hostname?: string;
  raw?: Record<string, unknown>;
}

export interface TriageResult {
  alert_id: string;
  priority: Priority;
  confidence: number;
  summary: string;
  mitre_tactic: string;
  mitre_technique: string;
  recommended_actions: string[];
  escalate: boolean;
  false_positive_likelihood: number;
  triaged_at: string;
}

export interface TriagedAlert extends Alert, TriageResult {}

export interface DashboardStats {
  total_alerts: number;
  by_priority: Record<string, number>;
  average_confidence: number;
  escalation_rate: number;
  by_mitre_tactic: Record<string, number>;
  by_mitre_technique: Record<string, number>;
  recent_alerts: TriagedAlert[];
  false_positive_avg: number;
}

export interface Settings {
  anthropic: { model: string; max_tokens: number; api_key: string };
  slack: { enabled: boolean; webhook_url: string };
  jira: {
    enabled: boolean;
    url: string;
    email: string;
    api_token: string;
    project_key: string;
  };
  virustotal: { enabled: boolean; api_key: string };
  triage: { false_positive_threshold: number; log_level: string };
}
