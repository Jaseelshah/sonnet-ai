export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type ResponseAction = "isolate_host" | "block_ip" | "reset_password" | "dismiss";

export interface ResponseActionEntry {
  id: string;
  alert_id: string;
  action: ResponseAction;
  analyst: string;
  status: "simulated" | "executed" | "failed";
  timestamp: string;
  details?: string;
}

export type FeedbackStatus = "confirmed" | "corrected" | "pending";

export interface AlertFeedback {
  alert_id: string;
  status: FeedbackStatus;
  corrected_priority?: Priority;
  analyst_note?: string;
  reviewed_at: string;
  reviewed_by: string;
}

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
  tenant_id?: string;
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
  feedback_coverage: number;
  corrections_count: number;
}

export interface ExecutiveReport {
  generated_at: string;
  period: string;
  total_alerts: number;
  by_priority: Record<string, number>;
  top_tactics: Array<{ tactic: string; count: number }>;
  average_confidence: number;
  escalation_rate: number;
  feedback_accuracy: number;
  feedback_total: number;
  feedback_confirmed: number;
  feedback_corrected: number;
  crown_jewel_escalations: number;
  time_saved_hours: number;
  alerts_per_day: number;
  tenant_breakdown?: Record<string, number>;
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
