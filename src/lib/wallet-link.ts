/**
 * Linked wallets, the rules (no server-only import, so they are unit-tested;
 * the /api/wallets routes and the session check call them).
 *
 * A ZAPR account has one main wallet (the one it was created with, which
 * receives the zaps) and up to MAX_LINKED_WALLETS more wallets that sign in to
 * the same account: a Google wallet (Privy), another app, another account of
 * the same app…
 */
import { buildLinkMessage, isValidWallet, verifySignature } from "./auth-core";
import type { Store, User } from "./db/types";

/** How many extra wallets one account can link (on top of its main wallet). */
export const MAX_LINKED_WALLETS = 5;

/** A link message must be signed within this time (the challenge cookie also expires). */
export const LINK_CHALLENGE_TTL_MS = 5 * 60_000;

/** The signed challenge, as stored in the short-lived nonce cookie. */
export interface LinkChallenge {
  nonce: string;
  wallet: string;
  issuedAt: number;
  purpose?: "link";
  userId?: string;
}

export type Outcome<T = object> =
  | ({ ok: true } & T)
  | { ok: false; status: number; error: string; code?: string };

const fail = (status: number, error: string, code?: string) => ({ ok: false as const, status, error, code });

/** The app name the wallet gave itself ("Phantom", "Privy"…), shown to the owner only. */
export function cleanLabel(raw: unknown): string {
  return typeof raw === "string" ? raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40) : "";
}

/** Every wallet that signs in to this account: the main one first, then the linked ones. */
export async function walletsOfUser(store: Store, u: User): Promise<string[]> {
  const linked = await store.listLinkedWallets(u.id);
  return [u.wallet, ...linked.map((w) => w.wallet)];
}

/**
 * The account a session belongs to, or null. A session opened with a linked
 * wallet ends as soon as that wallet is unlinked.
 */
export async function sessionUser(
  store: Store,
  session: { wallet: string; userId: string | null } | null,
): Promise<User | null> {
  if (!session?.userId) return null;
  const user = await store.getUserById(session.userId);
  if (!user) return null;
  if (session.wallet !== user.wallet && !(await walletsOfUser(store, user)).includes(session.wallet)) return null;
  return user;
}

/**
 * Link `wallet` to `me`: the wallet must have signed the link message of a
 * challenge issued for this account and this wallet, less than 5 minutes ago.
 */
export async function linkWalletToAccount(
  store: Store,
  args: { me: User; challenge: LinkChallenge | null; wallet: unknown; signature: unknown; label: unknown; now?: number },
): Promise<Outcome<{ already: boolean }>> {
  const { me, challenge } = args;
  const wallet = typeof args.wallet === "string" ? args.wallet : "";
  const signature = typeof args.signature === "string" ? args.signature : "";
  if (me.banned) {
    return fail(403, "Your account is suspended: you can't post, comment, zap or follow.", "banned");
  }
  if (!isValidWallet(wallet) || !signature) return fail(400, "Invalid request.");

  const now = args.now ?? Date.now();
  if (
    !challenge ||
    challenge.purpose !== "link" ||
    challenge.wallet !== wallet ||
    challenge.userId !== me.id ||
    !(now - challenge.issuedAt <= LINK_CHALLENGE_TTL_MS && challenge.issuedAt <= now + 60_000)
  ) {
    return fail(401, "Link request expired. Try again.");
  }
  const message = buildLinkMessage({ wallet, handle: me.handle, nonce: challenge.nonce, issuedAt: challenge.issuedAt });
  if (!verifySignature({ wallet, message, signatureBase58: signature })) return fail(401, "Invalid signature.");

  const result = await store.linkWallet({ userId: me.id, wallet, label: cleanLabel(args.label) }, MAX_LINKED_WALLETS);
  if (result === "taken") {
    const other = await store.getUserByWallet(wallet);
    return fail(
      409,
      `This wallet already has its own ZAPR account${other ? ` (@${other.handle})` : ""}. ` +
        "Two accounts can't be merged: use a wallet that isn't on ZAPR yet.",
      "wallet_taken",
    );
  }
  if (result === "limit") {
    return fail(409, `You can link up to ${MAX_LINKED_WALLETS} wallets. Unlink one first.`, "wallet_limit");
  }
  return { ok: true, already: result === "already" };
}

/** Unlink a wallet: never the main one, nor the one this session signed in with. */
export async function unlinkWalletFromAccount(
  store: Store,
  args: { me: User; sessionWallet: string | null; wallet: unknown },
): Promise<Outcome> {
  const { me, sessionWallet } = args;
  const wallet = typeof args.wallet === "string" ? args.wallet : "";
  if (wallet === me.wallet) {
    return fail(400, "This is your main wallet: it receives your zaps and can't be unlinked.");
  }
  if (sessionWallet === wallet) {
    return fail(
      409,
      "You signed in with this wallet. Sign in with another one of your wallets to unlink it.",
      "wallet_in_use",
    );
  }
  if (!(await store.unlinkWallet(me.id, wallet))) return fail(404, "This wallet isn't linked to your account.");
  return { ok: true };
}
