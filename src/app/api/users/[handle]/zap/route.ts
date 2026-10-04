import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser, publicUser } from "@/lib/current-user";
import { CREATOR_ZAP_SPLIT, MIN_CREATOR_ZAP_SOL, splitLamports } from "@/lib/pump-config";
import { onchainVerifyRequired, verifyPumpTransaction } from "@/lib/verify-pump";
import { solToLamports } from "@/lib/format";
import { formatSol } from "@/lib/pump-rules";

export const runtime = "nodejs";

// Waiting for Solana (verification retries) can take a few seconds.
export const maxDuration = 30;

/**
 * Record a creator zap. The on-chain transfers (90/10 by default) already
 * happened client-side; this updates the creator's zapped total and the
 * zapper's given total. No effect on the creator's posts.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Connect your wallet to zap a creator." }, { status: 401 });

  const store = getStore();
  const target = await store.getUserByHandle((await params).handle);
  if (!target) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  if (target.id === me.id) return NextResponse.json({ error: "You can't zap yourself." }, { status: 400 });

  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  const signature = typeof body?.signature === "string" ? body.signature.trim() : "";
  const anonymous = Boolean(body?.anonymous);
  if (!(amount > 0)) return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  if (!signature) return NextResponse.json({ error: "Missing transaction signature." }, { status: 400 });
  if (amount < MIN_CREATOR_ZAP_SOL) {
    return NextResponse.json({ error: `Minimum ${formatSol(MIN_CREATOR_ZAP_SOL)} SOL per creator zap.` }, { status: 400 });
  }

  // Idempotency: a transaction is recorded once, as a post zap OR a creator zap.
  if ((await store.getCreatorZapBySignature(signature)) || (await store.getPumpBySignature(signature))) {
    return NextResponse.json({ error: "This zap was already recorded.", code: "already_recorded" }, { status: 409 });
  }

  const { founderBps } = CREATOR_ZAP_SPLIT;
  if (onchainVerifyRequired()) {
    const v = await verifyPumpTransaction({
      signature,
      pumperWallet: me.wallet,
      creatorWallet: target.wallet,
      amountSol: amount,
      founderBps,
    });
    if (!v.ok) {
      return NextResponse.json(
        { error: v.reason || "On-chain verification failed.", code: v.retryable ? "verify_pending" : "verify_failed" },
        { status: v.retryable ? 503 : 400 },
      );
    }
  }

  // Split computed server-side, never trusted from the client.
  const { creatorLamports, founderLamports } = splitLamports(solToLamports(amount), founderBps);
  await store.recordCreatorZap({
    creatorUserId: target.id,
    zapperUserId: me.id,
    amount,
    creatorAmount: creatorLamports / 1e9,
    founderAmount: founderLamports / 1e9,
    signature,
    anonymous: anonymous || me.anonymizePumps,
  });

  const updated = await store.getUserById(target.id);
  return NextResponse.json({ user: updated ? publicUser(updated) : null });
}
