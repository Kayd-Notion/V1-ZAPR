import "server-only";
import { getSession } from "./session";
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
    hidePumpHistory: u.hidePumpHistory,
    anonymizePumps: u.anonymizePumps,
    createdAt: u.createdAt,
  };
}

export type PublicUser = ReturnType<typeof publicUser>;
