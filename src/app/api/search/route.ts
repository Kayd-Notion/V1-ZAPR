import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { publicUser } from "@/lib/current-user";

export const runtime = "nodejs";

/** Search live posts (text, #tags, author) and users (handle). Open to visitors. */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim().slice(0, 50);
  if (q.replace(/^[#@]/, "").length < 1) return NextResponse.json({ posts: [], users: [] });
  const { posts, users } = await getStore().search(q, 30);
  return NextResponse.json({ posts, users: users.map(publicUser) });
}
