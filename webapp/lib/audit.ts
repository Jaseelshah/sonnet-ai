import fs from "fs/promises";
import path from "path";
import { ROOT } from "./data";

const AUDIT_LOG_PATH = path.join(ROOT, "logs", "audit.log");

export interface AuditEntry {
  timestamp: string;
  action: string;
  user: string;
  ip: string;
  details?: string;
  outcome: "success" | "failure" | "denied";
}

/**
 * Append an audit log entry to logs/audit.log.
 * Non-blocking — errors are silently swallowed to never break request flow.
 */
export async function audit(entry: Omit<AuditEntry, "timestamp">): Promise<void> {
  const full: AuditEntry = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  const line = JSON.stringify(full) + "\n";

  try {
    await fs.mkdir(path.dirname(AUDIT_LOG_PATH), { recursive: true });
    await fs.appendFile(AUDIT_LOG_PATH, line, "utf-8");
  } catch {
    // Never let audit logging break the request
  }
}

/**
 * Extract client IP from request headers.
 */
export function getClientIP(request: Request): string {
  const forwarded = (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}
