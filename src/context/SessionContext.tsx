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
import type { WalletName } from "@solana/wallet-adapter-base";
import bs58 from "bs58";
import { PRIVY_WALLET_NAME, socialLogout } from "@/lib/social-login";
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
  /** Every wallet that signs in to the account: the main one first, then the linked ones. */
  userWallets: string[];
  /**
   * Linking mode (Settings → Link a wallet): while on, connecting a wallet
   * that isn't on the account yet asks it to sign the link message, instead of
   * ending the session.
   */
  linking: boolean;
  startLinking: () => void;
  /** "Link Google" was clicked: linking resumes after the trip to Google, for the Google wallet only. */
  prepareSocialLink: () => void;
  /** Leaves linking mode; a wallet left connected but not linked is let go. */
  stopLinking: () => Promise<void>;
  /** The person picked a wallet again: try linking it even if it failed before. */
  retryLink: () => void;
  /** A wallet is being asked to sign the link message. */
  linkSigning: boolean;
  /**
   * Switch to another wallet app (Phantom → Google wallet…) and connect it.
   * The current one is disconnected first: switching while it is still
   * connected can make the wallet library drop both.
   */
  switchWallet: (name: WalletName) => void;
  requireAuth: (msg?: string) => boolean;
  /** Call when the user explicitly picks a wallet to sign in (never on auto-connect). */
  beginLogin: () => void;
  completeOnboarding: (handle: string, bio?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: ClientUser | null) => void;
}

const Ctx = createContext<SessionContextValue | null>(null);

// Survives the trip to Google / Apple when linking their wallet. After that
// trip only the Google wallet ("Privy") may be linked automatically.
const LINKING_KEY = "zapr_linking";
const LINKING_TTL_MS = 5 * 60_000;

// Non-sensitive hint (the real session is the httpOnly cookie) used to decide
// whether the wallet may silently auto-reconnect on page load.
function setLoggedInHint(on: boolean) {
  try {
    if (on) {
      localStorage.setItem("zapr_logged_in", "1");
      // Remembered after logout too: the Connect window then says "Welcome back".
      localStorage.setItem("zapr_returning", "1");
    }
    else localStorage.removeItem("zapr_logged_in");
  } catch {
    /* ignore */
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { publicKey, connected, connecting, signMessage, disconnect, connect, wallet, select } = useWallet();
  const { toast, openConnect, openOnboard, closeModal, activeModal } = useUI();

  const [user, setUser] = useState<ClientUser | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const authedFor = useRef<string | null>(null); // pubkey we've already authenticated
  const authInFlight = useRef(false);
  // Sign-in only runs after an explicit user action; a silent wallet
  // auto-reconnect on page load must never trigger a signature popup.
  const loginIntent = useRef(false);
  const [loginRequest, setLoginRequest] = useState(0);

  const walletAddress = publicKey ? publicKey.toBase58() : null;
  // Right after a switch (Phantom → Google wallet…), one render can pair the new
  // wallet with the previous address: the linking and account checks wait until
  // the selected wallet itself reports that address.
  const walletSettled = Boolean(
    wallet?.adapter.connected && walletAddress && wallet.adapter.publicKey?.toBase58() === walletAddress,
  );

  const userWallets = useMemo(
    () => (user ? [user.wallet, ...(user.linkedWallets ?? []).map((w) => w.wallet)] : []),
    [user],
  );

  // --- Switching wallet app ----------------------------------------------------
  const [switchTarget, setSwitchTarget] = useState<WalletName | null>(null);
  const switchDisconnecting = useRef(false);
  const switchWallet = useCallback((name: WalletName) => {
    switchDisconnecting.current = false;
    setSwitchTarget(name);
  }, []);
  useEffect(() => {
    if (!switchTarget) return;
    if (wallet?.adapter.name === switchTarget) {
      setSwitchTarget(null);
      if (!wallet.adapter.connected && !connecting) {
        connect().catch((e) => toast(e instanceof Error && e.message ? e.message : "Connection refused."));
      }
      return;
    }
    if (wallet && (connected || connecting)) {
      if (!switchDisconnecting.current) {
        switchDisconnecting.current = true;
        disconnect().catch(() => {});
      }
      return; // runs again once it is disconnected
    }
    select(switchTarget);
  }, [switchTarget, wallet, connected, connecting, select, connect, disconnect, toast]);

  // --- Linking ---------------------------------------------------------------
  const [linking, setLinking] = useState(false);
  const [linkSigning, setLinkSigning] = useState(false);
  const linkingRef = useRef(false);
  /** Letting go of a wallet that wasn't linked: the session must not end meanwhile. */
  const restoring = useRef(false);
  const linkPrev = useRef<WalletName | null>(null); // wallet in use before linking
  const linkTried = useRef<string | null>(null);
  const linkInFlight = useRef(false);
  /** "any": the Link window is open. "google": back from Google, only the Google wallet is linked. */
  const linkScope = useRef<"any" | "google">("any");
  const socialAsked = useRef(false); // "Link Google" was clicked
  // Latest values for callbacks that run after awaits.
  const latest = useRef({ walletAddress, userWallets, wallet, connected, activeModal });
  latest.current = { walletAddress, userWallets, wallet, connected, activeModal };

  // Back from Google / Apple in the middle of linking their wallet.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LINKING_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { at: number; prev: string | null };
      const left = LINKING_TTL_MS - (Date.now() - saved.at);
      if (left > 0) {
        linkingRef.current = true;
        linkScope.current = "google";
        socialAsked.current = true;
        linkPrev.current = saved.prev as WalletName | null;
        setLinking(true);
        // Google sign-in cancelled or never finished: stop waiting for it.
        const t = setTimeout(() => {
          if (linkScope.current === "google") void stopLinkingRef.current();
        }, left);
        return () => clearTimeout(t);
      } else {
        sessionStorage.removeItem(LINKING_KEY);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const startLinking = useCallback(() => {
    linkingRef.current = true;
    linkScope.current = "any";
    socialAsked.current = false;
    linkTried.current = null;
    linkPrev.current = latest.current.wallet?.adapter.name ?? null;
    setLinking(true);
  }, []);

  const prepareSocialLink = useCallback(() => {
    socialAsked.current = true;
    linkTried.current = null;
    try {
      sessionStorage.setItem(LINKING_KEY, JSON.stringify({ at: Date.now(), prev: linkPrev.current }));
    } catch {
      /* ignore */
    }
  }, []);

  const endLinking = useCallback(() => {
    linkingRef.current = false;
    linkScope.current = "any";
    socialAsked.current = false;
    setLinking(false);
    try {
      sessionStorage.removeItem(LINKING_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const stopLinking = useCallback(async () => {
    if (!linkingRef.current) return;
    const { walletAddress: addr, userWallets: mine, wallet: current, connected: on } = latest.current;
    const stray = on && addr && !mine.includes(addr);
    if (stray) restoring.current = true;
    endLinking();
    if (!stray) return;
    try {
      // A Google wallet that couldn't be linked: end that Google session too.
      if (current?.adapter.name === PRIVY_WALLET_NAME) await socialLogout();
      const prev = linkPrev.current;
      if (prev && prev !== current?.adapter.name) switchWallet(prev); // back to the wallet used before
      else await disconnect();
    } catch {
      /* ignore */
    } finally {
      restoring.current = false;
    }
  }, [endLinking, switchWallet, disconnect]);

  const stopLinkingRef = useRef(stopLinking);
  stopLinkingRef.current = stopLinking;

  const retryLink = useCallback(() => {
    linkTried.current = null;
  }, []);

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
        toast("This wallet can't sign messages.");
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
          toast(`gm ${res.user.handle}`);
        } else if (res.needsOnboarding) {
          setStatus("needs-onboarding");
          authedFor.current = address;
          openOnboard();
        }
      } catch (e) {
        setStatus("anonymous");
        authedFor.current = null;
        toast(e instanceof Error ? e.message : "Connection failed.");
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
    if (user && userWallets.includes(walletAddress)) {
      closeModal();
      return;
    }
    authedFor.current = null;
    authenticate(walletAddress);
  }, [loginRequest, connected, walletAddress, user, userWallets, status, authenticate, closeModal]);

  // Linking: a wallet that isn't on the account yet signs the link message.
  useEffect(() => {
    if (!linking || status !== "authed" || !user || !connected || !walletAddress || !walletSettled) return;
    const isGoogle = wallet?.adapter.name === PRIVY_WALLET_NAME;
    // Back from Google: only the Google wallet (never a Phantom account switch).
    if (linkScope.current === "google" && !isGoogle) return;
    if (userWallets.includes(walletAddress)) {
      // "Link Google" for a Google wallet that is already on this account.
      if (isGoogle && socialAsked.current) {
        endLinking();
        if (latest.current.activeModal === "link") closeModal();
        toast("Your Google wallet is already on this account.");
      }
      return;
    }
    if (linkInFlight.current || linkTried.current === walletAddress) return;
    linkTried.current = walletAddress;
    linkInFlight.current = true;
    setLinkSigning(true);
    (async () => {
      try {
        if (!signMessage) throw new Error("This wallet can't sign messages.");
        const { message } = await api.linkChallenge(walletAddress);
        const signature = bs58.encode(await signMessage(new TextEncoder().encode(message)));
        const res = await api.linkWallet(walletAddress, signature, latest.current.wallet?.adapter.name ?? "");
        setUser(res.user);
        endLinking();
        if (latest.current.activeModal === "link") closeModal();
        toast(
          res.already
            ? "This wallet is already on your account."
            : `Wallet linked: it now signs in to @${res.user.handle}.`,
        );
      } catch (e) {
        toast(e instanceof Error ? e.message : "Couldn't link this wallet.");
        // Not in the Link window (back from Google): give up and go back to the previous wallet.
        if (latest.current.activeModal !== "link") void stopLinking();
      } finally {
        linkInFlight.current = false;
        setLinkSigning(false);
      }
    })();
  }, [linking, status, user, connected, walletAddress, walletSettled, wallet, userWallets, signMessage, endLinking, stopLinking, closeModal, toast]);

  // The account selected in the wallet is not the one signed in to ZAPR (the
  // user switched accounts in Phantom, or reopened the site on another one):
  // zaps would be signed by one wallet and recorded for another, and admin /
  // profile would belong to the old account. End the old session and ask to
  // sign in with the current account (no signature popup by itself).
  // Wallets linked to the account are fine, and so is any wallet while linking.
  useEffect(() => {
    if (status !== "authed" || !user || !connected || !walletAddress || !walletSettled) return;
    if (authInFlight.current || userWallets.includes(walletAddress)) return;
    if (restoring.current) return;
    if ((linking || linkingRef.current) && (linkScope.current === "any" || wallet?.adapter.name === PRIVY_WALLET_NAME)) return;
    let cancelled = false;
    (async () => {
      try {
        await api.logout();
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      setUser(null);
      setStatus("anonymous");
      authedFor.current = null;
      openConnect(
        `You switched to another wallet (${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}). ` +
          "Sign in again to use it on ZAPR.",
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [status, user, userWallets, linking, connected, walletAddress, walletSettled, wallet, openConnect]);

  const completeOnboarding = useCallback(
    async (handle: string, bio?: string) => {
      const res = await api.onboard(handle, bio);
      setUser(res.user);
      setStatus("authed");
      closeModal();
      toast(`Welcome ${res.user.handle}. LFG.`);
    },
    [closeModal, toast],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    endLinking();
    // Signed in with Google / Apple: end the Privy session too.
    await socialLogout();
    try {
      await disconnect();
    } catch {
      /* ignore */
    }
    setUser(null);
    setStatus("anonymous");
    authedFor.current = null;
    toast("Wallet disconnected. See ya.");
  }, [disconnect, toast, endLinking]);

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
      userWallets,
      linking,
      startLinking,
      prepareSocialLink,
      stopLinking,
      retryLink,
      linkSigning,
      switchWallet,
      requireAuth,
      beginLogin,
      completeOnboarding,
      logout,
      refreshUser,
      setUser,
    }),
    [user, status, walletAddress, connected, userWallets, linking, startLinking, prepareSocialLink, stopLinking, retryLink, linkSigning, switchWallet, requireAuth, beginLogin, completeOnboarding, logout, refreshUser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
