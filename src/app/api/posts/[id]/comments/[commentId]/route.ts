import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser } from "@/lib/current-user";

export const runtime = "nodejs";

/** Delete a comment: its author, or the author of the post it is on. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "Connect your wallet first." }, { status: 401 });
  const { id, commentId } = await params;
  const ok = await getStore().deleteComment(commentId, me.id);
  if (!ok) return NextResponse.json({ error: "You can't delete this comment." }, { status: 403 });
  const comments = await getStore().listComments(id);
  return NextResponse.json({ comments });
}
