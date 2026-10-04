import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { buildSignInMessage, generateNonce, isValidWallet } from "@/lib/auth";
import { issueNonceCookie } from "@/lib/session";

export const runtime = "nodejs";

/** Issue a signing challenge (nonce) for a wallet. */
export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet") || "";
  if (!isValidWallet(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }
  const limited = await rateLimit("signin", wallet);
  if (limited) return limited;
  const nonce = generateNonce();
  const issuedAt = Date.now();
  await issueNonceCookie({ nonce, wallet, issuedAt });
  const message = buildSignInMessage({ wallet, nonce, issuedAt });
  return NextResponse.json({ message, nonce, issuedAt });
}
