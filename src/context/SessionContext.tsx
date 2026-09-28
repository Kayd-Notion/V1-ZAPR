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
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { api } from "@/lib/api";
import type { ClientUser } from "@/lib/client-types";
import { useUI } from "./UIContext";

type Status = "loading" | "anonymous" | "authenticating" | "authed" | "needs-onboarding";

interface SessionContextValue {
  user: ClientUser | null;
  status: Status;
  /** Wallet pubkey (base58) if a wallet is connected, else null. */
  walletAddress: string | null;
  walletConnected: boolean;
  requireAuth: (msg?: string) => boolean;
  /** Call when the user explicitly picks a wallet to sign in (never on auto-connect). */
  beginLogin: () => void;
  completeOnboarding: (handle: string, bio?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: ClientUser | null) => void;
}

const Ctx = createContext<SessionContextValue | null>(null);

// Non-sensitive hint (the real session is the httpOnly cookie) used to decide
// whether the wallet may silently auto-reconnect on page load.
function setLoggedInHint(on: boolean) {
  try {
    if (on) localStorage.setItem("ps_logged_in", "1");
    else localStorage.removeItem("ps_logged_in");
  } catch {
    /* ignore */
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, connected, signMessage, disconnect } = useWallet();
  const { toast, openConnect, openOnboard, closeModal } = useUI();

  const [user, setUser] = useState<ClientUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const authedFor = useRef<string | null>(null); // pubkey we've already authenticated
  const authInFlight = useRef(false);
  // Sign-in only runs after an explicit user action; a silent wallet
  // auto-reconnect on page load must never trigger a signature popup.
  const loginIntent = useRef(false);
  const [loginRequest, setLoginRequest] = useState(0);

  const walletAddress = publicKey ? publicKey.toBase58() : null;

  useEffect(() => {
    if (status !== "loading") setLoggedInHint(Boolean(user));
  }, [user, status]);

  // Restore session from cookie on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.me();
        if (cancelled) return;
        if (res.user) {
          setUser(res.user);
          setStatus("authed");
          authedFor.current = res.user.wallet;
        } else {
          setStatus("anonymous");
        }
      } catch {
        if (!cancelled) setStatus("anonymous");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const authenticate = useCallback(
    async (address: string) => {
      if (!signMessage) {
        toast("Ce wallet ne supporte pas la signature de message.");
        return;
      }
      if (authInFlight.current) return;
      authInFlight.current = true;
      setStatus("authenticating");
      try {
        const { message } = await api.nonce(address);
        const signatureBytes = await signMessage(new TextEncoder().encode(message));
        const signature = bs58.encode(signatureBytes);
        const res = await api.verify(address, signature);
        if (res.user) {
          setUser(res.user);
          setStatus("authed");
          authedFor.current = address;
          closeModal();
          toast(`✅ Connecté — gm ${res.user.handle}`);
        } else if (res.needsOnboarding) {
          setStatus("needs-onboarding");
          authedFor.current = address;
          openOnboard();
        }
      } catch (e) {
        setStatus("anonymous");
        authedFor.current = null;
        toast(e instanceof Error ? e.message : "Échec de la connexion.");
      } finally {
        authInFlight.current = false;
      }
    },
    [signMessage, toast, openOnboard, closeModal],
  );

  const beginLogin = useCallback(() => {
    loginIntent.current = true;
    setLoginRequest((n) => n + 1);
  }, []);

  // Run SIWS only once the user asked to log in AND the wallet is connected.
  // Waits for the cookie session restore so an existing session isn't re-signed.
  useEffect(() => {
    if (!loginIntent.current || status === "loading") return;
    if (!connected || !walletAddress) return;
    loginIntent.current = false;
    if (user && user.wallet === walletAddress) {
      closeModal();
      return;
    }
    authedFor.current = null;
    authenticate(walletAddress);
  }, [loginRequest, connected, walletAddress, user, status, authenticate, closeModal]);

  const completeOnboarding = useCallback(
    async (handle: string, bio?: string) => {
      const res = await api.onboard(handle, bio);
      setUser(res.user);
      setStatus("authed");
      closeModal();
      toast(`🎉 Bienvenue, ${res.user.handle} !`);
    },
    [closeModal, toast],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    try {
      await disconnect();
    } catch {
      /* ignore */
    }
    setUser(null);
    setStatus("anonymous");
    authedFor.current = null;
    toast("Wallet déconnecté");
  }, [disconnect, toast]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.me();
      setUser(res.user);
    } catch {
      /* ignore */
    }
  }, []);

  const requireAuth = useCallback(
    (msg?: string) => {
      if (user) return true;
      openConnect(msg);
      return false;
    },
    [user, openConnect],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      status,
      walletAddress,
      walletConnected: connected,
      requireAuth,
      beginLogin,
      completeOnboarding,
      logout,
      refreshUser,
      setUser,
    }),
    [user, status, walletAddress, connected, requireAuth, beginLogin, completeOnboarding, logout, refreshUser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
