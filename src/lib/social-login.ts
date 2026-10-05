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

/** Privy app id (dashboard.privy.io). Empty = Google / Apple sign-in hidden. */
export const PRIVY_APP_ID = (process.env.NEXT_PUBLIC_PRIVY_APP_ID || "").trim();

/** Which buttons to show, e.g. "google" or "google,apple" (Apple needs its own setup). */
export const SOCIAL_PROVIDERS: SocialProvider[] = PRIVY_APP_ID
  ? (process.env.NEXT_PUBLIC_SOCIAL_LOGINS || "google")
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter((p): p is SocialProvider => p === "google" || p === "apple")
  : [];

/** Name of the Privy embedded wallet in the Wallet Standard registry. */
export const PRIVY_WALLET_NAME = "Privy";

/** Set before leaving for Google / Apple; read when coming back to finish the ZAPR sign-in. */
export const SOCIAL_PENDING_KEY = "zapr_social_pending";

type Handlers = {
  login: (provider: SocialProvider) => Promise<void>;
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

/** Opens Privy's window to copy the embedded wallet's private key (to import it in Phantom…). */
export async function exportSocialWallet(): Promise<void> {
  if (!handlers) throw new Error("Not available right now.");
  await handlers.exportWallet();
}

/** Ends the Privy session too (so the next Google sign-in can pick another account). */
export async function socialLogout(): Promise<void> {
  if (handlers) await handlers.logout().catch(() => {});
}
