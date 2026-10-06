"use client";
/**
 * Sign-in with Google / Apple, through Privy: the person signs in with their
 * account and Privy gives them a Solana wallet (an "embedded wallet") that ZAPR
 * then uses exactly like Phantom (see components/PrivyBridge.tsx).
 *
 * This file stays tiny on purpose: the Connect window imports it, while the
 * Privy SDK itself is only loaded when NEXT_PUBLIC_PRIVY_APP_ID is set.
 */

export type SocialProvider = "google" | "apple";

export interface PrivyConfig {
  /** The App ID to use, or "" when Google / Apple sign-in is off. */
  appId: string;
  /** Buttons to show (empty when off). */
  providers: SocialProvider[];
  /** Why it is off or partly ignored, in plain words (for the browser console). */
  problem: string | null;
}

/**
 * Reads NEXT_PUBLIC_PRIVY_APP_ID and NEXT_PUBLIC_SOCIAL_LOGINS. Pure (tested).
 * A Privy App ID is 25 letters and digits; quotes or spaces pasted around it
 * are removed. Anything else turns Google / Apple sign-in off, never the site
 * (Privy itself would crash on a wrong id).
 */
export function parsePrivyConfig(rawAppId: string | undefined, rawLogins: string | undefined): PrivyConfig {
  const id = (rawAppId || "").trim().replace(/^["']+|["']+$/g, "").trim();
  if (!id) {
    return {
      appId: "",
      providers: [],
      problem: "Google sign-in is off: NEXT_PUBLIC_PRIVY_APP_ID is not set (see docs/PRIVY-SETUP.md).",
    };
  }
  if (!/^[a-z0-9]{25}$/i.test(id)) {
    return {
      appId: "",
      providers: [],
      problem:
        `Google sign-in is off: NEXT_PUBLIC_PRIVY_APP_ID doesn't look like a Privy App ID ` +
        `(expected 25 letters and digits, got ${id.length} characters). Copy it again from dashboard.privy.io ` +
        "(see docs/PRIVY-SETUP.md), then redeploy.",
    };
  }
  const asked = (rawLogins || "google").split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
  const providers = asked.filter((p): p is SocialProvider => p === "google" || p === "apple");
  const unknown = asked.filter((p) => p !== "google" && p !== "apple");
  if (providers.length === 0) {
    return {
      appId: id,
      providers: [],
      problem: `Google sign-in is off: NEXT_PUBLIC_SOCIAL_LOGINS should be "google" (got "${rawLogins}").`,
    };
  }
  return {
    appId: id,
    providers,
    problem: unknown.length ? `NEXT_PUBLIC_SOCIAL_LOGINS: ignored "${unknown.join(", ")}" (use "google").` : null,
  };
}

// NEXT_PUBLIC_* values are written into the code when the site is built.
const CONFIG = parsePrivyConfig(process.env.NEXT_PUBLIC_PRIVY_APP_ID, process.env.NEXT_PUBLIC_SOCIAL_LOGINS);

/** Privy app id (dashboard.privy.io). Empty = Google / Apple sign-in hidden. */
export const PRIVY_APP_ID = CONFIG.appId;

/** Which buttons to show: "google" (Apple needs its own setup, postponed). */
export const SOCIAL_PROVIDERS: SocialProvider[] = CONFIG.providers;

/** Says once in the browser console why Google sign-in is off (or partly ignored). */
export function reportSocialLoginConfig(): void {
  if (!CONFIG.problem) return;
  if (CONFIG.appId) console.warn(`[ZAPR] ${CONFIG.problem}`);
  else if (process.env.NEXT_PUBLIC_PRIVY_APP_ID) console.error(`[ZAPR] ${CONFIG.problem}`);
  else console.info(`[ZAPR] ${CONFIG.problem}`);
}

/** Name of the Privy embedded wallet in the Wallet Standard registry. */
export const PRIVY_WALLET_NAME = "Privy";

/**
 * Set before leaving for Google / Apple; read when coming back to finish the
 * ZAPR sign-in ("google") or the linking of that wallet ("link:google").
 */
export const SOCIAL_PENDING_KEY = "zapr_social_pending";

type Handlers = {
  login: (provider: SocialProvider) => Promise<void>;
  /** Same trip to Google / Apple, but the wallet is then linked to the signed-in account. */
  link: (provider: SocialProvider) => Promise<void>;
  exportWallet: () => Promise<void>;
  logout: () => Promise<void>;
};

let handlers: Handlers | null = null;

/** Called by PrivyBridge once Privy is loaded (null when it unmounts). */
export function setSocialHandlers(h: Handlers | null): void {
  handlers = h;
}

export function socialLoginReady(): boolean {
  return handlers !== null;
}

export async function startSocialLogin(provider: SocialProvider): Promise<void> {
  if (!handlers) throw new Error("Sign-in is still loading, try again in a second.");
  await handlers.login(provider);
}

/** Settings → Link a wallet → Google / Apple. */
export async function startSocialLink(provider: SocialProvider): Promise<void> {
  if (!handlers) throw new Error("Sign-in is still loading, try again in a second.");
  await handlers.link(provider);
}

/** Opens Privy's window to copy the embedded wallet's private key (to import it in Phantom…). */
export async function exportSocialWallet(): Promise<void> {
  if (!handlers) throw new Error("Not available right now.");
  await handlers.exportWallet();
}

/** Ends the Privy session too (so the next Google sign-in can pick another account). */
export async function socialLogout(): Promise<void> {
  if (handlers) await handlers.logout().catch(() => {});
}
