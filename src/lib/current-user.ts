import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "./session";
import { isAdmin } from "./admin";
import { getStore } from "./db";
import type { User } from "./db/types";

/** Resolve the fully-hydrated current user from the session cookie, or null. */
export async function currentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session?.userId) return null;
  return getStore().getUserById(session.userId);
}

/** Public projection of a user (safe to expose to clients). */
export function publicUser(u: User) {
  return {
    id: u.id,
    handle: u.handle,
    wallet: u.wallet,
    bio: u.bio,
    country: u.country,
    received: u.received,
    given: u.given,
    zapped: u.zapped,
    hidePumpHistory: u.hidePumpHistory,
    anonymizePumps: u.anonymizePumps,
    avatarUrl: u.avatarUrl,
    banned: u.banned,
    createdAt: u.createdAt,
  };
}

export type PublicUser = ReturnType<typeof publicUser>;

/** The signed-in user as sent to themselves: also says whether they are an admin. */
export function selfUser(u: User) {
  return { ...publicUser(u), isAdmin: isAdmin(u) };
}

/** Answer for a banned user trying to post, comment, zap, follow or report. */
export function suspended() {
  return NextResponse.json(
    { error: "Your account is suspended: you can't post, comment, zap or follow.", code: "banned" },
    { status: 403 },
  );
}
