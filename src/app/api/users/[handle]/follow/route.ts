import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser, suspended } from "@/lib/current-user";

export const runtime = "nodejs";

/** Follow (POST) or unfollow (DELETE) a creator. Free; returns the new stats. */
async function handle(method: "follow" | "unfollow", params: Promise<{ handle: string }>) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Connect your wallet to follow creators." }, { status: 401 });
  if (me.banned && method === "follow") return suspended();
  const store = getStore();
  const target = await store.getUserByHandle((await params).handle);
  if (!target) return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  if (target.id === me.id) return NextResponse.json({ error: "You can't follow yourself." }, { status: 400 });

  if (method === "follow") await store.follow(me.id, target.id);
  else await store.unfollow(me.id, target.id);
  return NextResponse.json(await store.followStats(target.id, me.id));
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  return handle("follow", params);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  return handle("unfollow", params);
}
