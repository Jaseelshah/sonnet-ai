import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-me"
);
const COOKIE_NAME = "sonnet-ai-token";
const TOKEN_EXPIRY = "8h";

/**
 * Creates a signed JWT for the given email address.
 */
export async function createToken(email: string): Promise<string> {
  return new SignJWT({ email })
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
): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { email: string };
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
