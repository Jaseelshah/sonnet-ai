import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET_RAW = process.env.JWT_SECRET;
if (!JWT_SECRET_RAW) {
  console.error("FATAL: JWT_SECRET environment variable is required. Set it in .env.local");
}
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW || "");
const COOKIE_NAME = "sonnet-ai-token";
const TOKEN_EXPIRY = "8h";

/**
 * Creates a signed JWT for the given email address and role.
 */
export async function createToken(email: string, role: string): Promise<string> {
  return new SignJWT({ email, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

/**
 * Verifies a JWT and returns its payload, or null if invalid/expired.
 */
export async function verifyToken(
  token: string
): Promise<{ email: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { email: string; role: string };
  } catch {
    return null;
  }
}

/**
 * Reads the auth token from the Next.js cookie store.
 * For use in server-side API route handlers only — not middleware.
 */
export function getTokenFromCookies(): string | undefined {
  try {
    const cookieStore = cookies();
    return cookieStore.get(COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
}

export { COOKIE_NAME };
