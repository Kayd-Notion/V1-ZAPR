import { NextRequest, NextResponse } from "next/server";
import { currentUser, publicUser } from "@/lib/current-user";
import { getStore } from "@/lib/db";
import { normalizeHandle } from "@/lib/auth";

export const runtime = "nodejs";

/** Update the current user's profile / privacy settings. */
export async function PATCH(req: NextRequest) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const store = getStore();
  const patch: Parameters<typeof store.updateUser>[1] = {};

  if (typeof body?.bio === "string") patch.bio = body.bio.slice(0, 240);
  if (typeof body?.hidePumpHistory === "boolean") patch.hidePumpHistory = body.hidePumpHistory;
  if (typeof body?.anonymizePumps === "boolean") patch.anonymizePumps = body.anonymizePumps;

  if (typeof body?.handle === "string" && body.handle.trim()) {
    const handle = normalizeHandle(body.handle);
    if (!handle) {
      return NextResponse.json({ error: "Pseudo invalide." }, { status: 400 });
    }
    if (handle.toLowerCase() !== me.handle.toLowerCase()) {
      const taken = await store.getUserByHandle(handle);
      if (taken) return NextResponse.json({ error: "Ce pseudo est déjà pris." }, { status: 409 });
      patch.handle = handle;
    }
  }

  const updated = await store.updateUser(me.id, patch);
  return NextResponse.json({ user: publicUser(updated) });
}
