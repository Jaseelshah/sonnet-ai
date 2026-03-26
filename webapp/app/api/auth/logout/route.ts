import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyToken } from "@/lib/auth";
import { validateOrigin } from "@/lib/csrf";
import { audit, getClientIP } from "@/lib/audit";

export async function POST(request: NextRequest) {
  const csrfError = validateOrigin(request);
  if (csrfError) return csrfError;

  // Extract user identity from the token before clearing the cookie.
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const user = token ? await verifyToken(token) : null;

  await audit({
    action: "logout",
    user: user?.email || "unknown",
    ip: getClientIP(request),
    outcome: "success",
  });

  const response = NextResponse.json({ success: true });

  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
