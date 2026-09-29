import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { currentUser, publicUser } from "@/lib/current-user";

export const runtime = "nodejs";

/** Return the current session's user, or a needsOnboarding hint, or null. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ user: null, needsOnboarding: true, wallet: session.wallet });
  }
  return NextResponse.json({ user: publicUser(user) });
}
