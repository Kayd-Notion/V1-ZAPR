import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/current-user";

export const runtime = "nodejs";

/** Ids of the creators the current user follows (empty for visitors). */
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ ids: [] });
  return NextResponse.json({ ids: await getStore().listFollowingIds(me.id) });
}
