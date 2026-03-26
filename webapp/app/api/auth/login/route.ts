import { NextRequest, NextResponse } from "next/server";
import { createToken, COOKIE_NAME } from "@/lib/auth";

const MAX_AGE_SECONDS = 8 * 60 * 60; // 8 hours

interface LoginRequestBody {
  email: string;
  password: string;
}

export async function POST(request: NextRequest) {
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
    return NextResponse.json(
      { error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const token = await createToken(email);

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
