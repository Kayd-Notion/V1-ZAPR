import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { buildLinkMessage, generateNonce, isValidWallet } from "@/lib/auth";
import { currentUser, suspended } from "@/lib/current-user";
import { issueNonceCookie } from "@/lib/session";

export const runtime = "nodejs";

/** The message another wallet signs to be linked to the signed-in account. */
export async function GET(req: NextRequest) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (me.banned) return suspended();
  const wallet = req.nextUrl.searchParams.get("wallet") || "";
  if (!isValidWallet(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }
  const limited = await rateLimit("link", me.id);
  if (limited) return limited;
  const nonce = generateNonce();
  const issuedAt = Date.now();
  await issueNonceCookie({ nonce, wallet, issuedAt, purpose: "link", userId: me.id });
  return NextResponse.json({ message: buildLinkMessage({ wallet, handle: me.handle, nonce, issuedAt }) });
}
