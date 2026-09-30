import "server-only";
import { createMemoryStore } from "./memory";
import { createPostgresStore } from "./postgres";
import { databaseUrl } from "./url";
import { PURGE_GRACE_MS } from "../lifespan";
import type { Store } from "./types";

/**
 * Single data-access entry point. Picks the storage from env:
 *  - DATABASE_URL (or POSTGRES_URL) set → Postgres (Supabase / Neon)
 *  - otherwise         → file-backed dev store (seeded), so the app runs locally
 *
 * Kept behind the `Store` interface so swapping storage never touches callers.
 */
let store: Store | null = null;

export function getStore(): Store {
  if (store) return store;
  store = databaseUrl() ? createPostgresStore() : createMemoryStore();
  return store;
}

const PURGE_EVERY_MS = 60_000;
let lastPurge = 0;

/**
 * Deletes expired posts for good, at most once a minute per server instance.
 * Called from the feed and leaderboard routes, which the live feed polls, so
 * no cron is needed. Expired posts are already hidden from every read; the
 * grace period lets a zap signed at the last second still be recorded.
 */
export async function purgeIfDue(): Promise<void> {
  const now = Date.now();
  if (now - lastPurge < PURGE_EVERY_MS) return;
  lastPurge = now;
  try {
    await getStore().purgeExpired(now - PURGE_GRACE_MS);
  } catch (e) {
    console.error("purge failed", e);
  }
}

export type { Store } from "./types";
