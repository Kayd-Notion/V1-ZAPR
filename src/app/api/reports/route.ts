import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { getStore } from "@/lib/db";
import { currentUser, suspended } from "@/lib/current-user";
import { REPORT_REASONS, type ReportReason } from "@/lib/db/types";

export const runtime = "nodejs";

/** Report a post or a comment. One report per user and target. */
export async function POST(req: NextRequest) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Connect your wallet to report." }, { status: 401 });
  if (me.banned) return suspended();
  const limited = await rateLimit("report", me.id);
  if (limited) return limited;

  const body = await req.json().catch(() => null);
  const targetType = body?.targetType;
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";
  const reason = body?.reason as ReportReason;
  const details = typeof body?.details === "string" ? body.details.trim().slice(0, 300) : "";
  if ((targetType !== "post" && targetType !== "comment") || !targetId) {
    return NextResponse.json({ error: "Nothing to report." }, { status: 400 });
  }
  if (!REPORT_REASONS.includes(reason)) return NextResponse.json({ error: "Pick a reason." }, { status: 400 });

  const result = await getStore().createReport({ reporterId: me.id, targetType, targetId, reason, details });
  if (result === "not_found") return NextResponse.json({ error: "It's gone already." }, { status: 404 });
  return NextResponse.json({ ok: true, duplicate: result === "duplicate" });
}
