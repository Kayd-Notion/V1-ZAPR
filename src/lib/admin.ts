import "server-only";
import type { User } from "./db/types";

/**
 * Admins (moderation page, hide/ban): the founder wallet
 * (NEXT_PUBLIC_FOUNDER_WALLET, the one receiving the platform share) plus any
 * wallet listed in ADMIN_WALLETS (comma-separated). Without either, nobody is
 * admin.
 */
function adminWallets(): Set<string> {
  const list = (process.env.ADMIN_WALLETS || "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
  const founder = (process.env.NEXT_PUBLIC_FOUNDER_WALLET || "").trim();
  if (founder) list.push(founder);
  return new Set(list);
}

export function isAdmin(user: Pick<User, "wallet"> | null | undefined): boolean {
  return Boolean(user && adminWallets().has(user.wallet));
}
