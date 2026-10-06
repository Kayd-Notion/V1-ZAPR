import { NextRequest, NextResponse } from "next/server";
import { currentUser, selfUser } from "@/lib/current-user";
import { clearNonceCookie, getSession, readNonceCookie } from "@/lib/session";
import { getStore } from "@/lib/db";
import { linkWalletToAccount, unlinkWalletFromAccount } from "@/lib/wallet-link";

export const runtime = "nodejs";

/**
 * Linked wallets: more wallets that sign in to the same account (Google ↔
 * Phantom…). The main wallet (the one the account was created with) keeps
 * receiving the zaps; any of them can send zaps. Rules: lib/wallet-link.ts.
 */

/** Link a wallet: it signed the challenge from /api/wallets/challenge. */
export async function POST(req: NextRequest) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const challenge = await readNonceCookie();
  await clearNonceCookie(); // one try per challenge
  const r = await linkWalletToAccount(getStore(), {
    me,
    challenge,
    wallet: body?.wallet,
    signature: body?.signature,
    label: body?.label,
  });
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
  return NextResponse.json({ user: await selfUser(me), already: r.already });
}

/** Unlink a wallet (never the main one, nor the one this session signed in with). */
export async function DELETE(req: NextRequest) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const session = await getSession();
  const r = await unlinkWalletFromAccount(getStore(), { me, sessionWallet: session?.wallet ?? null, wallet: body?.wallet });
  if (!r.ok) return NextResponse.json({ error: r.error, code: r.code }, { status: r.status });
  return NextResponse.json({ user: await selfUser(me) });
}
