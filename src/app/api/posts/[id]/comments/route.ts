import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/current-user";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const comments = await getStore().listComments(id);
  return NextResponse.json({ comments });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await currentUser();
  if (!me) {
    return NextResponse.json({ error: "Connecte ton wallet pour commenter." }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Commentaire vide." }, { status: 400 });
  if (text.length > 300) {
    return NextResponse.json({ error: "Commentaire trop long (max 300)." }, { status: 400 });
  }

  const post = await getStore().getPost(id);
  if (!post) return NextResponse.json({ error: "Post introuvable." }, { status: 404 });

  await getStore().addComment({ postId: id, userId: me.id, text });
  const comments = await getStore().listComments(id);
  return NextResponse.json({ comments });
}
