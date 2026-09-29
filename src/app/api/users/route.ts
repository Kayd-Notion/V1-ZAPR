import { NextRequest, NextResponse } from "next/server";
import { getSession, createSession } from "@/lib/session";
import { getStore } from "@/lib/db";
import { normalizeHandle } from "@/lib/auth";
import { countryFromRequest } from "@/lib/geo";
import { publicUser } from "@/lib/current-user";

export const runtime = "nodejs";

/** Onboarding: create the pseudo/user for a verified-but-not-yet-registered wallet. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Connecte ton wallet d'abord." }, { status: 401 });
  }

  const store = getStore();
  const existing = await store.getUserByWallet(session.wallet);
  if (existing) {
    // Already onboarded — make sure the session carries the userId.
    await createSession({ wallet: session.wallet, userId: existing.id });
    return NextResponse.json({ user: publicUser(existing) });
  }

  const body = await req.json().catch(() => null);
  const handle = normalizeHandle(body?.handle ?? "");
  if (!handle) {
    return NextResponse.json(
      { error: "Pseudo invalide (3-20 caractères : lettres, chiffres, _)." },
      { status: 400 },
    );
  }

  if (await store.getUserByHandle(handle)) {
    return NextResponse.json({ error: "Ce pseudo est déjà pris." }, { status: 409 });
  }

  const country = countryFromRequest(req);
  const user = await store.createUser({
    handle,
    wallet: session.wallet,
    bio: typeof body?.bio === "string" ? body.bio.slice(0, 240) : "",
    country,
  });
  await createSession({ wallet: session.wallet, userId: user.id });
  return NextResponse.json({ user: publicUser(user) });
}
