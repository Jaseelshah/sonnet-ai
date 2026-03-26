import { NextResponse } from "next/server";
import { getTokenFromCookies, verifyToken } from "@/lib/auth";

export async function GET() {
  const token = getTokenFromCookies();

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const payload = await verifyToken(token);

  if (!payload) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({ authenticated: true, email: payload.email, role: payload.role });
}
