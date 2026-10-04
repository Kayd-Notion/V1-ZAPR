import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/current-user";
import { isAdmin, NOT_FOUND } from "@/lib/admin";

export const runtime = "nodejs";

type Action = "hide_post" | "unhide_post" | "delete_comment" | "ban_user" | "unban_user" | "dismiss";
const ACTIONS: Action[] = ["hide_post", "unhide_post", "delete_comment", "ban_user", "unban_user", "dismiss"];

/**
 * One moderation action. Acting on a reported post or comment also closes its
 * open reports ("actioned"); "dismiss" closes them without acting.
 */
export async function POST(req: NextRequest) {
  const me = await currentUser();
  if (!me || !isAdmin(me)) return NextResponse.json(NOT_FOUND, { status: 404 });

  const body = await req.json().catch(() => null);
  const action = body?.action as Action;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!ACTIONS.includes(action) || !id) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const store = getStore();

  let ok = false;
  switch (action) {
    case "hide_post":
      ok = await store.setPostHidden(id, true);
      if (ok) await store.resolveReports("post", id, "actioned");
      break;
    case "unhide_post":
      ok = await store.setPostHidden(id, false);
      break;
    case "delete_comment":
      ok = await store.removeComment(id);
      await store.resolveReports("comment", id, "actioned");
      break;
    case "ban_user":
      if (id === me.id) return NextResponse.json({ error: "You can't ban yourself." }, { status: 400 });
      ok = await store.setUserBanned(id, true);
      // The report that led to the ban (if any) is handled.
      if (ok && (body?.targetType === "post" || body?.targetType === "comment") && typeof body?.targetId === "string") {
        await store.resolveReports(body.targetType, body.targetId, "actioned");
      }
      break;
    case "unban_user":
      ok = await store.setUserBanned(id, false);
      break;
    case "dismiss": {
      const type = body?.targetType === "comment" ? "comment" : "post";
      ok = (await store.resolveReports(type, id, "dismissed")) > 0;
      break;
    }
  }
  if (!ok) return NextResponse.json({ error: "Nothing changed (already done, or not found)." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
