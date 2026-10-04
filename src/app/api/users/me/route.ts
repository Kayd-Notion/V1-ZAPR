import { NextRequest, NextResponse } from "next/server";
import { currentUser, selfUser, suspended } from "@/lib/current-user";
import { getStore } from "@/lib/db";
import { normalizeHandle } from "@/lib/auth";
import { isIrysUrl } from "@/lib/media-url";

export const runtime = "nodejs";

/** Update the current user's profile / privacy settings. */
export async function PATCH(req: NextRequest) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (me.banned) return suspended();

  const body = await req.json().catch(() => null);
  const store = getStore();
  const patch: Parameters<typeof store.updateUser>[1] = {};

  if (typeof body?.bio === "string") patch.bio = body.bio.slice(0, 240);
  if (typeof body?.hidePumpHistory === "boolean") patch.hidePumpHistory = body.hidePumpHistory;
  if (typeof body?.anonymizePumps === "boolean") patch.anonymizePumps = body.anonymizePumps;
  // Profile picture: an uploaded Arweave URL, or null to go back to initials.
  if (body && "avatarUrl" in body) {
    if (body.avatarUrl !== null && !isIrysUrl(body.avatarUrl)) {
      return NextResponse.json({ error: "The picture must be uploaded through ZAPR." }, { status: 400 });
    }
    patch.avatarUrl = body.avatarUrl;
  }

  if (typeof body?.handle === "string" && body.handle.trim()) {
    const handle = normalizeHandle(body.handle);
    if (!handle) {
      return NextResponse.json({ error: "Invalid username." }, { status: 400 });
    }
    if (handle.toLowerCase() !== me.handle.toLowerCase()) {
      const taken = await store.getUserByHandle(handle);
      if (taken) return NextResponse.json({ error: "That username is taken." }, { status: 409 });
      patch.handle = handle;
    }
  }

  const updated = await store.updateUser(me.id, patch);
  return NextResponse.json({ user: selfUser(updated) });
}
