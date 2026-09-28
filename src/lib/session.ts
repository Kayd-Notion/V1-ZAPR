import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/**
 * Session = a signed JWT in an httpOnly cookie. Payload holds the verified
 * wallet and (once onboarded) the user id.
 */
const COOKIE = "ps_session";
const NONCE_COOKIE = "ps_nonce";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const NONCE_MAX_AGE = 60 * 5; // 5 minutes

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me-please";
  return new TextEncoder().encode(s);
}

export interface SessionData {
  wallet: string;
  userId: string | null;
}

export async function createSession(data: SessionData): Promise<void> {
  const token = await new SignJWT({ ...data })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function getSession(): Promise<SessionData | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.wallet !== "string") return null;
    return { wallet: payload.wallet, userId: (payload.userId as string) ?? null };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

// --- Nonce (challenge) cookie: stateless, short-lived -----------------------

export interface NonceData {
  nonce: string;
  wallet: string;
  issuedAt: number;
}

export async function issueNonceCookie(data: NonceData): Promise<void> {
  const token = await new SignJWT({ ...data })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${NONCE_MAX_AGE}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(NONCE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: NONCE_MAX_AGE,
  });
}

export async function readNonceCookie(): Promise<NonceData | null> {
  const jar = await cookies();
  const token = jar.get(NONCE_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      nonce: payload.nonce as string,
      wallet: payload.wallet as string,
      issuedAt: payload.issuedAt as number,
    };
  } catch {
    return null;
  }
}

export async function clearNonceCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(NONCE_COOKIE);
}
