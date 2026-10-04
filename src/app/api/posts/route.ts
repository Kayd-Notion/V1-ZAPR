import { NextRequest, NextResponse } from "next/server";
import { getStore, purgeIfDue } from "@/lib/db";
import { currentUser, suspended } from "@/lib/current-user";
import { countryFromRequest } from "@/lib/geo";
import type { MediaType } from "@/lib/db/types";
import { isIrysUrl } from "@/lib/media-url";

export const runtime = "nodejs";

const MAX_TEXT = 500;

function extractTags(text: string): string[] {
  const found = text.match(/#[\p{L}0-9_]+/gu) || [];
  return Array.from(new Set(found.map((t) => t.toLowerCase()))).slice(0, 8);
}

/** Feed, most recent first (read-only — available in visitor mode). */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Number(sp.get("limit")) || 20, 50);
  const before = sp.get("before") ? Number(sp.get("before")) : undefined;

  // "Abonnements" feed: posts of the creators the current user follows.
  let authorIds: string[] | undefined;
  if (sp.get("following") === "1") {
    const me = await currentUser();
    authorIds = me ? await getStore().listFollowingIds(me.id) : [];
    if (authorIds.length === 0) return NextResponse.json({ posts: [], nextCursor: null });
  }

  await purgeIfDue();
  const posts = await getStore().listPosts({ limit, before, authorIds });
  const nextCursor = posts.length === limit ? posts[posts.length - 1].createdAt : null;
  return NextResponse.json({ posts, nextCursor });
}

/** Create a post (requires connected + onboarded user). */
export async function POST(req: NextRequest) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "Connect your wallet to post." }, { status: 401 });
  }
  if (me.banned) return suspended();

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Write something." }, { status: 400 });
  if (text.length > MAX_TEXT) {
    return NextResponse.json({ error: `Text too long (max ${MAX_TEXT}).` }, { status: 400 });
  }

  const mediaUrl = isIrysUrl(body?.mediaUrl) ? body.mediaUrl : null;
  if (body?.mediaUrl && !mediaUrl) {
    return NextResponse.json({ error: "Media must be uploaded through ZAPR." }, { status: 400 });
  }
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
