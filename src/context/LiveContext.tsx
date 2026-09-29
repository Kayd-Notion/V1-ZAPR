"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useUI } from "./UIContext";
import type { ClientPost } from "@/lib/client-types";

/** How often the latest posts are re-fetched, and how many. */
const POLL_MS = 4000;
const LIVE_LIMIT = 40;
/** How long a freshly arrived post stays highlighted. */
const FLASH_MS = 2500;

interface LiveValue {
  /** Latest posts, most recent first (null until the first load). */
  posts: ClientPost[] | null;
  /** Ids that just appeared, for the highlight animation. */
  freshIds: Set<string>;
  refresh: () => void;
}

const Ctx = createContext<LiveValue | null>(null);

/**
 * One poller for the whole app (live column, home feed, ticker share it), so
 * every screen sees new posts within a few seconds without a websocket.
 * Paused while the tab is hidden; re-fetches at once when data changes locally.
 */
export function LiveProvider({ children }: { children: React.ReactNode }) {
  const { dataVersion } = useUI();
  const [posts, setPosts] = useState<ClientPost[] | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const known = useRef<Set<string> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.feed(undefined, LIVE_LIMIT);
      const ids = res.posts.map((p) => p.id);
      // First load: nothing is "new". Later loads: flash the unseen ids.
      if (known.current) {
        const arrived = ids.filter((id) => !known.current!.has(id));
        if (arrived.length) {
          setFreshIds(new Set(arrived));
          setTimeout(() => setFreshIds(new Set()), FLASH_MS);
        }
      }
      known.current = new Set(ids);
      setPosts(res.posts);
    } catch {
      setPosts((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const t = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  const value = useMemo(() => ({ posts, freshIds, refresh }), [posts, freshIds, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLive(): LiveValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLive must be used within LiveProvider");
  return ctx;
}

/** Current time, re-rendering the caller every `ms` (for "12s" style labels). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
