import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/current-user";

export const runtime = "nodejs";

/** Follow (POST) or unfollow (DELETE) a creator. Free; returns the new stats. */
async function handle(method: "follow" | "unfollow", params: Promise<{ handle: string }>) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Connecte ton wallet pour suivre des créateurs." }, { status: 401 });
  const store = getStore();
  const target = await store.getUserByHandle((await params).handle);
  if (!target) return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  if (target.id === me.id) return NextResponse.json({ error: "Tu ne peux pas te suivre toi-même." }, { status: 400 });

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
