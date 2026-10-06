import "server-only";
import { NextResponse } from "next/server";
import { getStore } from "./db";

/**
 * Anti-spam limits, per user (or per wallet before sign-up), never per IP.
 * Generous for people, tight for bots.
 */
export const LIMITS = {
  post: { max: 8, windowMs: 10 * 60_000, what: "posts" },
  comment: { max: 30, windowMs: 10 * 60_000, what: "comments" },
  follow: { max: 60, windowMs: 10 * 60_000, what: "follows" },
  report: { max: 20, windowMs: 60 * 60_000, what: "reports" },
  profile: { max: 20, windowMs: 10 * 60_000, what: "profile changes" },
  signin: { max: 10, windowMs: 10 * 60_000, what: "sign-in attempts" },
  link: { max: 10, windowMs: 10 * 60_000, what: "wallet link attempts" },
} as const;

export type LimitName = keyof typeof LIMITS;

/**
 * Counts one more `name` action for `who`. Returns a 429 answer once the
 * limit is passed, or null when the action may go on. If the counter can't be
 * reached, the action is allowed (a limit never blocks the app).
 */
export async function rateLimit(name: LimitName, who: string): Promise<NextResponse | null> {
  const { max, windowMs, what } = LIMITS[name];
  let count = 0;
  try {
    count = await getStore().hitRateLimit(`${name}:${who}`, windowMs);
  } catch (e) {
    console.error("rate limit unavailable", e);
    return null;
  }
  if (count <= max) return null;
  const minutes = Math.round(windowMs / 60_000);
  return NextResponse.json(
    { error: `Slow down: max ${max} ${what} per ${minutes} minutes. Try again in a bit.`, code: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) } },
  );
}
