import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/current-user";
import type { ActivityFilter, NotificationCursor } from "@/lib/db/types";

export const runtime = "nodejs";

const PAGE = 30;
const FILTERS: ActivityFilter[] = ["all", "in", "out"];

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

/** The signed-in user's money history: zaps sent, creator shares received. */
export async function GET(req: NextRequest) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Connect your wallet to see your activity." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const filter = (FILTERS as string[]).includes(sp.get("filter") ?? "") ? (sp.get("filter") as ActivityFilter) : "all";
  const rawCursor = sp.get("cursor");
  const before = rawCursor ? decodeCursor(rawCursor) : undefined;
  if (rawCursor && !before) return NextResponse.json({ error: "Invalid cursor." }, { status: 400 });

  const items = await getStore().listActivity(me.id, { limit: PAGE, filter, before: before ?? undefined });
  const last = items[items.length - 1];
  return NextResponse.json({
    items,
    nextCursor:
      items.length === PAGE
        ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString("base64url")
        : null,
  });
}
