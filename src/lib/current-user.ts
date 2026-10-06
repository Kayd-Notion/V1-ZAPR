import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "./session";
import { isAdmin } from "./admin";
import { getStore } from "./db";
import type { User } from "./db/types";

/**
 * Resolve the fully-hydrated current user from the session cookie, or null.
 * A session opened with a linked wallet ends once that wallet is unlinked.
 */
export async function currentUser(): Promise<User | null> {
  const session = await getSession();
  if (!session?.userId) return null;
  const user = await getStore().getUserById(session.userId);
  if (!user) return null;
  if (session.wallet !== user.wallet && !(await walletsOf(user)).includes(session.wallet)) return null;
  return user;
}

/** Every wallet that signs in to this account: the main one first, then the linked ones. */
export async function walletsOf(u: User): Promise<string[]> {
  const linked = await getStore().listLinkedWallets(u.id);
  return [u.wallet, ...linked.map((w) => w.wallet)];
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

/**
 * The signed-in user as sent to themselves: also says whether they are an
 * admin, and lists their linked wallets (never shown to anyone else).
 */
export async function selfUser(u: User) {
  const linkedWallets = await getStore().listLinkedWallets(u.id);
  return { ...publicUser(u), isAdmin: isAdmin(u), linkedWallets };
}

/** Answer for a banned user trying to post, comment, zap, follow or report. */
export function suspended() {
  return NextResponse.json(
    { error: "Your account is suspended: you can't post, comment, zap or follow.", code: "banned" },
    { status: 403 },
  );
}
