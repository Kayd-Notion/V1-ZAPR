import { NextRequest, NextResponse } from "next/server";
import { getSession, createSession } from "@/lib/session";
import { getStore } from "@/lib/db";
import { WALLET_IN_USE } from "@/lib/db/types";
import { normalizeHandle } from "@/lib/auth";
import { countryFromRequest } from "@/lib/geo";
import { selfUser } from "@/lib/current-user";

export const runtime = "nodejs";

/** Onboarding: create the pseudo/user for a verified-but-not-yet-registered wallet. */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Connect your wallet first." }, { status: 401 });
  }

  const store = getStore();
  const existing = await store.getUserByWallet(session.wallet);
  if (existing) {
    // Already onboarded — make sure the session carries the userId.
    await createSession({ wallet: session.wallet, userId: existing.id });
    return NextResponse.json({ user: await selfUser(existing) });
  }

  const body = await req.json().catch(() => null);
  const handle = normalizeHandle(body?.handle ?? "");
  if (!handle) {
    return NextResponse.json(
      { error: "Invalid username (3-20 characters: letters, numbers, _)." },
      { status: 400 },
    );
  }

  if (await store.getUserByHandle(handle)) {
    return NextResponse.json({ error: "That username is taken." }, { status: 409 });
  }

  const country = countryFromRequest(req);
  let user;
  try {
    user = await store.createUser({
      handle,
      wallet: session.wallet,
      bio: typeof body?.bio === "string" ? body.bio.slice(0, 240) : "",
      country,
    });
  } catch (e) {
    // Linked to an account a moment ago (another tab): sign in to that account instead.
    if (e instanceof Error && e.message === WALLET_IN_USE) {
      const owner = await store.getUserByWallet(session.wallet);
      if (owner) {
        await createSession({ wallet: session.wallet, userId: owner.id });
        return NextResponse.json({ user: await selfUser(owner) });
      }
    }
    throw e;
  }
  await createSession({ wallet: session.wallet, userId: user.id });
  return NextResponse.json({ user: await selfUser(user) });
}
