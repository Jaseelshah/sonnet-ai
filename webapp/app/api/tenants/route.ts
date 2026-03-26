import { NextResponse } from "next/server";

export async function GET() {
  const raw = process.env.TENANTS || "";
  const tenants = raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return NextResponse.json({ tenants });
}
