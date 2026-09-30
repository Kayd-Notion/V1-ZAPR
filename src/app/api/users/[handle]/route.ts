import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { publicUser } from "@/lib/current-user";

export const runtime = "nodejs";

/** Public profile + live posts (expired posts are deleted, they never show). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const store = getStore();
  const user = await store.getUserByHandle(handle);
  if (!user) return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });

  const active = await store.listPosts({ limit: 100, authorId: user.id });

  const pub = publicUser(user);
  return NextResponse.json({
    user: pub,
    postsCount: active.length,
    active,
  });
}
