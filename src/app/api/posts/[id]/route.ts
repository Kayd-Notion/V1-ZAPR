import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { shortWallet } from "@/lib/format";
import { currentUser } from "@/lib/current-user";

export const runtime = "nodejs";

/** Post detail: the post, its pumpers (privacy-masked), and comments. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const store = getStore();
  const post = await store.getPost(id);
  if (!post) return NextResponse.json({ error: "Post not found." }, { status: 404 });

  const [pumpersRaw, comments] = await Promise.all([
    store.listPumpers(id),
    store.listComments(id),
  ]);

  // Privacy: for anonymous pumps, never leak the author — mask server-side.
  // A self-zap (the creator zapping their own post) is a zap like any other:
  // no flag, no badge (founder's decision, October 2026).
  const pumpers = pumpersRaw.map((p, i) => {
    if (p.anonymous) {
      return {
        id: p.id,
        amount: p.amount,
        createdAt: p.createdAt,
        anonymous: true,
        label: `Anonymous zapper #${i + 1}`,
        author: null as null,
      };
    }
    return {
      id: p.id,
      amount: p.amount,
      createdAt: p.createdAt,
      anonymous: false,
      label: p.author.handle,
      author: {
        id: p.author.id,
        handle: p.author.handle,
        wallet: shortWallet(p.author.wallet),
        avatarUrl: p.author.avatarUrl,
      },
    };
  });

  return NextResponse.json({ post, pumpers, comments });
}

/** Delete a post: its author only, and only while it has received no zap. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Connect your wallet first." }, { status: 401 });
  const { id } = await params;
  const result = await getStore().deletePost(id, me.id);
  switch (result) {
    case "deleted":
      return NextResponse.json({ ok: true });
    case "has_zaps":
      return NextResponse.json(
        { error: "This post got zaps: it can't be deleted anymore.", code: "has_zaps" },
        { status: 409 },
      );
    case "not_author":
      return NextResponse.json({ error: "Only the author can delete this post." }, { status: 403 });
    default:
      return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
}
