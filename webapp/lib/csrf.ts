import { NextRequest, NextResponse } from "next/server";

/**
 * Validates that state-changing requests originate from the same site.
 *
 * Checks the Origin header (or Referer as fallback) against the request host.
 * This is the OWASP-recommended approach for modern SPA applications — it
 * requires no extra cookies or tokens while reliably blocking cross-origin POSTs
 * because browsers always include the Origin header on cross-origin requests.
 *
 * Returns null if the request is valid, or a 403 NextResponse if it is not.
 */
export function validateOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  // Without a host header we cannot validate anything — let it through.
  if (!host) return null;

  // Derive the source origin from the Origin header, falling back to the
  // origin extracted from Referer (same-site navigations may omit Origin).
  let source: string | null = origin;
  if (!source && referer) {
    try {
      source = new URL(referer).origin;
    } catch {
      // Malformed Referer — treat as missing.
      source = null;
    }
  }

  // If no source header is present at all, the request is either server-side
  // or same-origin. Browsers always send Origin on cross-origin POSTs, so the
  // absence of both headers means this is a safe same-origin request.
  if (!source) return null;

  // Validate that the source host matches the request host exactly.
  let sourceHost: string;
  try {
    sourceHost = new URL(source).host;
  } catch {
    // Unparseable origin — reject to be safe.
    return NextResponse.json(
      { error: "Forbidden: unparseable origin header" },
      { status: 403 }
    );
  }

  if (sourceHost !== host) {
    return NextResponse.json(
      { error: "Forbidden: cross-origin request rejected" },
      { status: 403 }
    );
  }

  return null;
}
