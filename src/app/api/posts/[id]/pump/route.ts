import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/current-user";
import { resolvedSplitBps } from "@/lib/pump-config";
import { onchainVerifyRequired, verifyPumpTransaction } from "@/lib/verify-pump";
import { solToLamports } from "@/lib/format";
import { lifespanInfo, PURGE_GRACE_MS } from "@/lib/lifespan";
import { MIN_PUMP_SOL } from "@/lib/pump-config";
import { formatSol } from "@/lib/pump-rules";

export const runtime = "nodejs";

// Waiting for Solana (verification retries) can take a few seconds.
export const maxDuration = 30;

/**
 * Record a completed pump. The on-chain transfer(s) already happened client-side
 * (lib/pump.ts); this persists the off-chain aggregates (post total, creator
 * received, pumper given) that drive lifespan + leaderboards.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "Connect your wallet to send a zap." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  const signature = typeof body?.signature === "string" ? body.signature.trim() : "";
  const anonymous = Boolean(body?.anonymous);

  if (!(amount > 0)) {
    return NextResponse.json({ error: "Invalid amount." }, { status: 400 });
  }
  if (!signature) {
    return NextResponse.json({ error: "Missing transaction signature." }, { status: 400 });
  }
  // Rule 3, server-side even if the client skipped the pre-check.
  if (amount < MIN_PUMP_SOL) {
    return NextResponse.json(
      { error: `Minimum ${formatSol(MIN_PUMP_SOL)} SOL per zap.`, code: "below_min_pump" },
      { status: 400 },
    );
  }

  const store = getStore();
  // The zap was checked (prepare) while the post was alive; it may have
  // expired while the wallet was signing. The money has moved, so record it
  // (which also extends the post's life) unless the post is already deleted.
  const post = await store.getPost(id, { graceMs: PURGE_GRACE_MS, includeHidden: true });
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  // Idempotency: a transaction is recorded once, as a post zap OR a creator zap.
  if ((await store.getPumpBySignature(signature)) || (await store.getCreatorZapBySignature(signature))) {
    return NextResponse.json({ error: "This zap was already recorded.", code: "already_recorded" }, { status: 409 });
  }

  // Integrity: re-check the transaction on-chain (prod). Skipped in dev.
  if (onchainVerifyRequired()) {
    const v = await verifyPumpTransaction({
      signature,
      pumperWallet: me.wallet,
      creatorWallet: post.author.wallet,
      amountSol: amount,
    });
    if (!v.ok) {
      return NextResponse.json(
        { error: v.reason || "On-chain verification failed.", code: v.retryable ? "verify_pending" : "verify_failed" },
        { status: v.retryable ? 503 : 400 },
      );
    }
  }

  // Compute split server-side (never trust client amounts for the aggregates).
  const totalLamports = solToLamports(amount);
  const { creatorBps } = resolvedSplitBps();
  const creatorLamports = Math.floor(totalLamports) - Math.floor((totalLamports * (10000 - creatorBps)) / 10000);
  const founderLamports = Math.floor(totalLamports) - creatorLamports;

  const { post: updated } = await store.recordPump({
    postId: id,
    pumperUserId: me.id,
    amount,
    creatorAmount: creatorLamports / 1e9,
    founderAmount: founderLamports / 1e9,
    signature,
    anonymous: anonymous || me.anonymizePumps,
  });

  const full = await store.getPost(id, { graceMs: PURGE_GRACE_MS, includeHidden: true });
  const info = lifespanInfo(updated.createdAt, updated.pumped);
  return NextResponse.json({
    post: full,
    lifespan: { totalHours: info.totalHours, remainingMs: info.remainingMs, expired: info.expired },
  });
}
