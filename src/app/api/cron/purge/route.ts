import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { PURGE_GRACE_MS } from "@/lib/lifespan";

export const runtime = "nodejs";

/**
 * Daily clean-up, called by Vercel Cron (vercel.json): deletes posts that
 * expired more than the grace period ago, even on quiet days when nobody opens
 * the feed (the feed also purges on the fly, at most once a minute).
 * With CRON_SECRET set, only Vercel's call (Bearer CRON_SECRET) is accepted;
 * the job is harmless anyway (it only removes what is already dead).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const purged = await getStore().purgeExpired(Date.now() - PURGE_GRACE_MS);
  return NextResponse.json({ ok: true, purged });
}
