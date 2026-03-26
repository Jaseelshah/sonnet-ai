import { NextRequest, NextResponse } from "next/server";
import { createToken, COOKIE_NAME } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { audit, getClientIP } from "@/lib/audit";

const MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

// ---------------------------------------------------------------------------
// In-memory rate limiter: max 5 attempts per IP per 15 minutes.
// Uses a simple Map — no external dependencies. Entries are pruned every
// 5 minutes so the Map does not grow unboundedly under sustained load.
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 5;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return { allowed: true };
}

// Periodically clean up expired entries (every 5 minutes).
setInterval(() => {
  const now = Date.now();
  loginAttempts.forEach((entry, ip) => {
    if (now >= entry.resetAt) loginAttempts.delete(ip);
  });
}, 5 * 60 * 1000);

interface LoginRequestBody {
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
  // CSRF check — reject cross-origin POSTs.
  const csrfError = validateOrigin(request);
  if (csrfError) return csrfError;

  // Rate limit check — applied before any credential work.
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    await audit({ action: "login_rate_limited", user: "unknown", ip, outcome: "denied" });
    return NextResponse.json(
      { error: "Too many login attempts. Try again later.", retryAfterSeconds: rateCheck.retryAfterSeconds },
      { status: 429 }
    );
  }

  let body: LoginRequestBody;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const validEmail = process.env.DASHBOARD_EMAIL;
  const validPassword = process.env.DASHBOARD_PASSWORD;

  if (email !== validEmail || password !== validPassword) {
    await audit({ action: "login", user: email || "unknown", ip: getClientIP(request), outcome: "failure" });
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const role = process.env.DASHBOARD_ROLE || "admin";
  const token = await createToken(email, role);

  await audit({ action: "login", user: email, ip: getClientIP(request), outcome: "success" });

  const response = NextResponse.json({ success: true });

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });

  return response;
}
