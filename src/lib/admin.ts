import "server-only";
import type { User } from "./db/types";

/**
 * The only admin (moderation page, hide / ban): the founder, i.e. the wallet in
 * NEXT_PUBLIC_FOUNDER_WALLET (the one receiving the platform share). No other
 * wallet can be admin; without that variable, nobody is.
 */
export function isAdmin(user: Pick<User, "wallet"> | null | undefined): boolean {
  const founder = (process.env.NEXT_PUBLIC_FOUNDER_WALLET || "").trim();
  return Boolean(user && founder && user.wallet === founder);
}

/** Admin routes answer like a missing page to everyone else: they don't reveal they exist. */
export const NOT_FOUND = { error: "Not found." } as const;
