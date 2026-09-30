import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/current-user";
import type { NotificationCursor } from "@/lib/db/types";

export const runtime = "nodejs";

const PAGE = 30;

// Opaque cursor = base64url(JSON {createdAt, id}) of the last item returned.
function decodeCursor(raw: string): NotificationCursor | null {
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (typeof c?.createdAt === "number" && typeof c?.id === "string") return c;
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * The current user's notifications, newest first. `seenAt` is when they last
 * opened this list, so the page can highlight what is new before marking it
 * seen (POST /api/notifications/seen).
 */
export async function GET(req: NextRequest) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Connect your wallet to see your notifications." }, { status: 401 });

  const rawCursor = req.nextUrl.searchParams.get("cursor");
  const before = rawCursor ? decodeCursor(rawCursor) : undefined;
  if (rawCursor && !before) return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });

  const store = getStore();
  const [items, seenAt] = await Promise.all([
    store.listNotifications(me.id, { limit: PAGE, before: before ?? undefined }),
    store.getNotificationsSeenAt(me.id),
  ]);
  const last = items[items.length - 1];
  return NextResponse.json({
    items,
    seenAt,
    nextCursor:
      items.length === PAGE
        ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString("base64url")
        : null,
  });
}
