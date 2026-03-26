import fs from "fs/promises";
import path from "path";

/**
 * Project root resolution.
 *
 * Assumption: when running via `next dev` or `next start`, the cwd is the
 * webapp/ directory. `path.resolve(process.cwd(), '..')` therefore points at
 * the sonnet-ai project root where `logs/` and `mock_data/` live.
 *
 * If the webapp is ever deployed as a standalone Next.js output, __dirname
 * will point inside .next/server/ and this path will need to be adjusted.
 * For now the cwd-based resolution is correct for local development.
 */
export const ROOT = path.resolve(process.cwd(), "..");

/** Absolute path to the triage results JSON log. */
export const triageResultsPath = path.join(ROOT, "logs", "triage_results.json");

/** Absolute path to the raw alerts mock data. */
export const rawAlertsPath = path.join(ROOT, "mock_data", "alerts.json");

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: unknown;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5_000; // 5 seconds — keep low for live SIEM polling

/**
 * Read and parse a JSON file from disk, with a 60-second in-memory cache.
 *
 * - Returns a cached result if the entry exists and is less than 60 s old.
 * - On any file or parse error, returns an empty array and does NOT populate
 *   the cache, so the next request will retry disk.
 */
export async function readJSON(filePath: string): Promise<unknown[]> {
  const now = Date.now();
  const cached = cache.get(filePath);

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.data as unknown[];
  }

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw);
    cache.set(filePath, { data, cachedAt: now });
    return data as unknown[];
  } catch {
    // Return empty array on missing file, empty file, or malformed JSON.
    // Do not cache the failure so the next request can retry.
    return [];
  }
}
