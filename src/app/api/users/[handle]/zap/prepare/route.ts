import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/current-user";
import { MIN_CREATOR_ZAP_SOL } from "@/lib/pump-config";
import { formatSol } from "@/lib/pump-rules";

export const runtime = "nodejs";

/**
 * Re-check right BEFORE the wallet signs a creator zap. If this refuses, the
 * client never builds nor signs the transaction.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Connect your wallet to zap a creator.", code: "auth_required" }, { status: 401 });

  const target = await getStore().getUserByHandle((await params).handle);
  if (!target) return NextResponse.json({ error: "Profile not found.", code: "not_found" }, { status: 404 });
  if (target.id === me.id) {
    return NextResponse.json({ error: "You can't zap yourself.", code: "self_zap" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const amount = Number(body?.amount);
  if (!(amount > 0)) return NextResponse.json({ error: "Invalid amount.", code: "invalid_amount" }, { status: 400 });
  if (amount < MIN_CREATOR_ZAP_SOL) {
    return NextResponse.json(
      { error: `Minimum ${formatSol(MIN_CREATOR_ZAP_SOL)} SOL per creator zap.`, code: "below_min" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, creatorWallet: target.wallet });
}
