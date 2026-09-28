"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ClientPost } from "@/lib/client-types";

type ModalKind = "connect" | "composer" | "pump" | "onboard" | null;

interface UIContextValue {
  // Toast
  toast: (msg: string) => void;
  // Theme
  theme: "dark" | "light";
  toggleTheme: () => void;
  // Modals
  activeModal: ModalKind;
  pumpTarget: ClientPost | null;
  connectMessage: string;
  openConnect: (msg?: string) => void;
  openComposer: () => void;
  openPump: (post: ClientPost) => void;
  openOnboard: () => void;
  closeModal: () => void;
  // Cross-view data invalidation (feed/leaderboard re-fetch on change)
  dataVersion: number;
  bumpData: () => void;
}

const Ctx = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [activeModal, setActiveModal] = useState<ModalKind>(null);
  const [pumpTarget, setPumpTarget] = useState<ClientPost | null>(null);
  const [connectMessage, setConnectMessage] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [toastShown, setToastShown] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted theme.
  useEffect(() => {
    try {
      const t = localStorage.getItem("ps_theme");
      if (t === "light" || t === "dark") setTheme(t);
    } catch {
      /* localStorage unavailable */
    }
  }, []);

  // Apply theme to <html>.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("ps_theme", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastShown(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastShown(false), 2400);
  }, []);

  const openConnect = useCallback((msg?: string) => {
    setConnectMessage(msg || "Connecte ton wallet Solana pour effectuer cette action.");
    setActiveModal("connect");
  }, []);
  const openComposer = useCallback(() => setActiveModal("composer"), []);
  const openPump = useCallback((post: ClientPost) => {
    setPumpTarget(post);
    setActiveModal("pump");
  }, []);
  const openOnboard = useCallback(() => setActiveModal("onboard"), []);
  const closeModal = useCallback(() => setActiveModal(null), []);
  const bumpData = useCallback(() => setDataVersion((v) => v + 1), []);

  const value = useMemo<UIContextValue>(
    () => ({
      toast,
      theme,
      toggleTheme,
      activeModal,
      pumpTarget,
      connectMessage,
      openConnect,
      openComposer,
      openPump,
      openOnboard,
      closeModal,
      dataVersion,
      bumpData,
    }),
    [
      toast,
      theme,
      toggleTheme,
      activeModal,
      pumpTarget,
      connectMessage,
      openConnect,
      openComposer,
      openPump,
      openOnboard,
      closeModal,
      dataVersion,
      bumpData,
    ],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className={`toast${toastShown ? " show" : ""}`}>{toastMsg}</div>
    </Ctx.Provider>
  );
}

export function useUI(): UIContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useUI must be used within UIProvider");
  return ctx;
}
