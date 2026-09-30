"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useSession } from "./SessionContext";
import { useUI } from "./UIContext";

/** How often the unread count is re-checked while the tab is visible. */
const POLL_MS = 30_000;

interface NotificationsValue {
  /** Notifications since the user last opened the list (0 for visitors). */
  unread: number;
  refresh: () => void;
  /** Mark everything as seen (called when the list is opened). */
  markSeen: () => Promise<void>;
}

const Ctx = createContext<NotificationsValue | null>(null);

/** Unread badge for the rail / top bar, shared by the whole app. */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const { dataVersion } = useUI();
  const [unread, setUnread] = useState(0);
  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) {
      setUnread(0);
      return;
    }
    try {
      setUnread((await api.unreadNotifications()).unread);
    } catch {
      /* keep the last count */
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh, dataVersion]);

  useEffect(() => {
    if (!userId) return;
    const tick = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const t = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [userId, refresh]);

  const markSeen = useCallback(async () => {
    setUnread(0);
    try {
      await api.markNotificationsSeen();
    } catch {
      /* the next poll brings the badge back */
    }
  }, []);

  const value = useMemo(() => ({ unread, refresh, markSeen }), [unread, refresh, markSeen]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNotifications must be used inside NotificationsProvider");
  return v;
}
