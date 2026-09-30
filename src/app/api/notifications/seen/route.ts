import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/current-user";

export const runtime = "nodejs";

/** Mark every notification up to now as seen. */
export async function POST() {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Connect your wallet first." }, { status: 401 });
  await getStore().setNotificationsSeenAt(me.id, Date.now());
  return NextResponse.json({ unread: 0 });
}
