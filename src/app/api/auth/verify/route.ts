import { NextRequest, NextResponse } from "next/server";
import { buildSignInMessage, isValidWallet, verifySignature } from "@/lib/auth";
import {
  clearNonceCookie,
  createSession,
  readNonceCookie,
} from "@/lib/session";
import { getStore } from "@/lib/db";
import { publicUser } from "@/lib/current-user";

export const runtime = "nodejs";

/** Verify a signed challenge and open a session. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const wallet = body?.wallet as string | undefined;
  const signature = body?.signature as string | undefined;

  if (!wallet || !isValidWallet(wallet) || !signature) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const challenge = await readNonceCookie();
  if (!challenge || challenge.wallet !== wallet) {
    return NextResponse.json(
      { error: "Défi expiré ou introuvable. Réessaie." },
      { status: 401 },
    );
  }

  const message = buildSignInMessage({
    wallet,
    nonce: challenge.nonce,
    issuedAt: challenge.issuedAt,
  });

  const ok = verifySignature({ wallet, message, signatureBase58: signature });
  await clearNonceCookie();
  if (!ok) {
    return NextResponse.json({ error: "Signature invalide." }, { status: 401 });
  }

  const store = getStore();
  const user = await store.getUserByWallet(wallet);
  await createSession({ wallet, userId: user?.id ?? null });

  if (!user) {
    return NextResponse.json({ needsOnboarding: true, wallet });
  }
  return NextResponse.json({ user: publicUser(user) });
}
