import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/current-user";
import { countryFromRequest } from "@/lib/geo";
import type { FeedQuery, MediaType } from "@/lib/db/types";

export const runtime = "nodejs";

const MAX_TEXT = 500;

function extractTags(text: string): string[] {
  const found = text.match(/#[\p{L}0-9_]+/gu) || [];
  return Array.from(new Set(found.map((t) => t.toLowerCase()))).slice(0, 8);
}

/** Feed (read-only — available in visitor mode). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tab = (sp.get("tab") as FeedQuery["tab"]) || "live";
  const limit = Math.min(Number(sp.get("limit")) || 20, 50);
  const before = sp.get("before") ? Number(sp.get("before")) : undefined;

  const posts = await getStore().listPosts({ tab, limit, before });
  const nextCursor = posts.length === limit ? posts[posts.length - 1].createdAt : null;
  return NextResponse.json({ posts, nextCursor });
}

/** Create a post (requires connected + onboarded user). */
export async function POST(req: NextRequest) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "Connecte ton wallet pour poster." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Écris quelque chose." }, { status: 400 });
  if (text.length > MAX_TEXT) {
    return NextResponse.json({ error: `Texte trop long (max ${MAX_TEXT}).` }, { status: 400 });
  }

  const mediaUrl = typeof body?.mediaUrl === "string" ? body.mediaUrl : null;
  const mediaType =
    body?.mediaType === "image" || body?.mediaType === "video"
      ? (body.mediaType as MediaType)
      : null;

  const post = await getStore().createPost({
    userId: me.id,
    text,
    mediaUrl: mediaUrl && mediaType ? mediaUrl : null,
    mediaType: mediaUrl && mediaType ? mediaType : null,
    country: countryFromRequest(req),
    tags: extractTags(text),
  });

  const full = await getStore().getPost(post.id);
  return NextResponse.json({ post: full });
}
