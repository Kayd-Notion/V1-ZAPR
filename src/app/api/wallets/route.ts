import { NextRequest, NextResponse } from "next/server";
import { buildLinkMessage, isValidWallet, verifySignature } from "@/lib/auth";
import { currentUser, selfUser, suspended } from "@/lib/current-user";
import { clearNonceCookie, getSession, readNonceCookie } from "@/lib/session";
import { getStore } from "@/lib/db";
import { MAX_LINKED_WALLETS } from "@/lib/linked-wallets";

export const runtime = "nodejs";

/**
 * Linked wallets: more wallets that sign in to the same account (Google ↔
 * Phantom…). The main wallet (the one the account was created with) keeps
 * receiving the zaps; any of them can send zaps.
 */

/** Link a wallet: it signed the challenge from /api/wallets/challenge. */
export async function POST(req: NextRequest) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (me.banned) return suspended();

  const body = await req.json().catch(() => null);
  const wallet = typeof body?.wallet === "string" ? body.wallet : "";
  const signature = typeof body?.signature === "string" ? body.signature : "";
  const label = typeof body?.label === "string" ? body.label.trim().slice(0, 40) : "";
  if (!isValidWallet(wallet) || !signature) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const challenge = await readNonceCookie();
  if (!challenge || challenge.purpose !== "link" || challenge.wallet !== wallet || challenge.userId !== me.id) {
    return NextResponse.json({ error: "Link request expired. Try again." }, { status: 401 });
  }
  const message = buildLinkMessage({ wallet, handle: me.handle, nonce: challenge.nonce, issuedAt: challenge.issuedAt });
  const ok = verifySignature({ wallet, message, signatureBase58: signature });
  await clearNonceCookie();
  if (!ok) return NextResponse.json({ error: "Invalid signature." }, { status: 401 });

  const store = getStore();
  const result = await store.linkWallet({ userId: me.id, wallet, label }, MAX_LINKED_WALLETS);
  if (result === "taken") {
    const other = await store.getUserByWallet(wallet);
    return NextResponse.json(
      {
        error:
          `This wallet already has its own ZAPR account${other ? ` (@${other.handle})` : ""}. ` +
          "Two accounts can't be merged: use a wallet that isn't on ZAPR yet.",
        code: "wallet_taken",
      },
      { status: 409 },
    );
  }
  if (result === "limit") {
    return NextResponse.json(
      { error: `You can link up to ${MAX_LINKED_WALLETS} wallets. Unlink one first.`, code: "wallet_limit" },
      { status: 409 },
    );
  }
  return NextResponse.json({ user: await selfUser(me), already: result === "already" });
}

/** Unlink a wallet (never the main one, nor the one this session signed in with). */
export async function DELETE(req: NextRequest) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const wallet = typeof body?.wallet === "string" ? body.wallet : "";
  if (wallet === me.wallet) {
    return NextResponse.json(
      { error: "This is your main wallet: it receives your zaps and can't be unlinked." },
      { status: 400 },
    );
  }
  const session = await getSession();
  if (session?.wallet === wallet) {
    return NextResponse.json(
      { error: "You signed in with this wallet. Sign in with another one of your wallets to unlink it.", code: "wallet_in_use" },
      { status: 409 },
    );
  }
  if (!(await getStore().unlinkWallet(me.id, wallet))) {
    return NextResponse.json({ error: "This wallet isn't linked to your account." }, { status: 404 });
  }
  return NextResponse.json({ user: await selfUser(me) });
}
