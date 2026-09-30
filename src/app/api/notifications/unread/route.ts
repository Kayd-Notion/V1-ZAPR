import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/current-user";

export const runtime = "nodejs";

/** Number of notifications since the user last opened them (0 for visitors, capped at 100). */
export async function GET() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ unread: 0 });
  const store = getStore();
  const seenAt = await store.getNotificationsSeenAt(me.id);
  return NextResponse.json({ unread: await store.countNotificationsSince(me.id, seenAt) });
}
