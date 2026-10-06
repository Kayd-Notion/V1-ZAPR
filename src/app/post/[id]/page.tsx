"use client";
import { use, useCallback, useEffect, useState } from "react";
import { IconBack, IconComment, IconFlag, IconShare, IconTrash, IconZap } from "@/components/icons";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { TimeGauge } from "@/components/TimeGauge";
import { BoostGauge } from "@/components/BoostGauge";
import { PostMenu } from "@/components/PostMenu";
import { RichText } from "@/components/RichText";
import { ZaprEmpty, ZaprLoader } from "@/components/ZaprMark";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { useLive, useNow } from "@/context/LiveContext";
import { api } from "@/lib/api";
import { fmtSol, shortWallet, timeAgo } from "@/lib/format";
import { lifespanInfo } from "@/lib/lifespan";
import { postUrl, shareLink } from "@/lib/share";
import type { ClientComment, ClientPost, ClientPumper } from "@/lib/client-types";

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { requireAuth, user } = useSession();
  const { openPump, toast, dataVersion, openReport } = useUI();

  const [post, setPost] = useState<ClientPost | null>(null);
  const [pumpers, setPumpers] = useState<ClientPumper[]>([]);
  const [comments, setComments] = useState<ClientComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [notFound, setNotFound] = useState(false);
  // Comment waiting for its second tap before being deleted.
  const [confirmComment, setConfirmComment] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.post(id);
      setPost(res.post);
      setPumpers(res.pumpers);
      setComments(res.comments);
    } catch {
      setNotFound(true);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load, dataVersion]);

  const now = useNow(5_000);
  // Live: reload when someone zaps this post (its total changed in the live feed).
  const { posts: livePosts } = useLive();
  const liveTotal = livePosts?.find((p) => p.id === id)?.pumped;
  useEffect(() => {
    if (liveTotal !== undefined && post && liveTotal !== post.pumped) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTotal]);

  if (notFound) {
    return (
      <ZaprEmpty title="Post not found.">
        <span>Maybe it was deleted. Or it never existed.</span>
      </ZaprEmpty>
    );
  }
  if (!post) return <ZaprLoader label="Loading…" />;

  // Expired posts are deleted: if it dies while open, say so.
  if (lifespanInfo(post.createdAt, post.pumped, now).expired) {
    return (
      <ZaprEmpty title="Too late, this post expired.">
        <span>It was deleted. No zap saved it in time.</span>
      </ZaprEmpty>
    );
  }

  const submitComment = async () => {
    if (!requireAuth("Connect your wallet to comment.")) return;
    const v = commentText.trim();
    if (!v) return;
    try {
      const res = await api.addComment(post.id, v);
      setComments(res.comments);
      setCommentText("");
      setPost({ ...post, comments: post.comments + 1 });
      toast("Comment posted.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't send.");
    }
  };

  const doPump = () => {
    if (!requireAuth("Connect your wallet to send a zap.")) return;
    openPump(post);
  };

  const share = async () => {
    const url = postUrl(post.id);
    const r = await shareLink(url, `@${post.author.handle} on ZAPR`);
    if (r === "copied") toast("Link copied. Go shill it.");
    else if (r === "failed") toast(url);
  };

  // Its author, or the post's author, can delete a comment (second tap confirms).
  const deleteComment = async (commentId: string) => {
    if (confirmComment !== commentId) {
      setConfirmComment(commentId);
      return;
    }
    setConfirmComment(null);
    try {
      const res = await api.deleteComment(post.id, commentId);
      setComments(res.comments);
      setPost({ ...post, comments: Math.max(0, post.comments - 1) });
      toast("Comment deleted.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't delete the comment.");
    }
  };

  return (
    <section>
      <div className="subbar">
        <button className="icon-btn" onClick={() => router.push("/")} aria-label="Back">
          <IconBack />
        </button>
        <div className="page-title">Post</div>
        <div className="subbar-actions">
          <button className="icon-btn" onClick={share} aria-label="Share" title="Share">
            <IconShare />
          </button>
          <PostMenu
            post={post}
            onDeleted={() => {
              router.push("/");
            }}
          />
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <div className="detail-post">
            <div className="dp-head">
              <Avatar id={post.author.id} handle={post.author.handle} src={post.author.avatarUrl} />
              <div style={{ cursor: "pointer" }} onClick={() => router.push(`/profile/${post.author.handle}`)}>
                <div className="name">{post.author.handle}</div>
                <div className="faint">
                  @{post.author.handle} · {timeAgo(post.createdAt)} ago
                </div>
              </div>
            </div>

            {post.deleted ? (
              <div className="dp-text faint" style={{ fontStyle: "italic" }}>
                This post expired and its content was deleted.
              </div>
            ) : (
              <RichText className="dp-text" text={post.text} />
            )}

            {post.mediaUrl && (
              <div className={`post-media${post.mediaType === "video" ? " video" : ""}`}>
                {post.mediaType === "video" ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={post.mediaUrl} controls />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.mediaUrl} alt={`Image posted by @${post.author.handle}`} />
                )}
              </div>
            )}

            <div className="post-stats">
              <TimeGauge createdAt={post.createdAt} pumped={post.pumped} />
              <div className="pumped-badge">
                <span className="pb-amount">
                  <IconZap />
                  {fmtSol(post.pumped)}
                </span>
                <span className="pb-label">SOL zapped</span>
              </div>
            </div>

            {post.deleted ? (
              // Rule 2.1: a purged post can't be zapped — no Zap button at all.
              <div className="pump-notice" style={{ marginBottom: 0 }}>
                <b className="notice-title">
                  <IconTrash /> Post deleted
                </b>
                It expired and its content was deleted: it can&apos;t get zaps anymore.
              </div>
            ) : (
              <>
                <BoostGauge total={post.pumped} />
                <button className="pump-btn pump-btn-lg" onClick={doPump}>
                  <IconZap /> Send a zap
                </button>
              </>
            )}
          </div>

          <div className="section-title">
            <IconComment /> Comments ({comments.length})
          </div>
          <div className="comment-form">
            <input
              className="field"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder="Say something…"
              maxLength={300}
            />
            <button className="btn btn-primary" onClick={submitComment}>
              Send
            </button>
          </div>
          {comments.map((c) => {
            const canDelete = Boolean(user && (user.id === c.userId || user.id === post.userId || user.isAdmin));
            const canReport = user?.id !== c.userId;
            return (
              <div className="comment" key={c.id}>
                <Avatar id={c.author.id} handle={c.author.handle} src={c.author.avatarUrl} size="sm" />
                <div className="c-body">
                  <div className="c-head">
                    <span className="name" onClick={() => router.push(`/profile/${c.author.handle}`)}>
                      {c.author.handle}
                    </span>
                    <span className="faint">{timeAgo(c.createdAt)} ago</span>
                    {canReport && (
                      <button
                        className={`c-report${canDelete ? "" : " solo"}`}
                        onClick={() => {
                          if (!requireAuth("Connect your wallet to report a comment.")) return;
                          openReport({ type: "comment", id: c.id, label: `@${c.author.handle}'s comment` });
                        }}
                        aria-label="Report comment"
                        title="Report comment"
                      >
                        <IconFlag />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className={`c-del${confirmComment === c.id ? " confirm" : ""}`}
                        onClick={() => deleteComment(c.id)}
                        onBlur={() => setConfirmComment(null)}
                        aria-label="Delete comment"
                        title="Delete comment"
                      >
                        <IconTrash />
                        {confirmComment === c.id && <span>Delete?</span>}
                      </button>
                    )}
                  </div>
                  <RichText className="c-text" text={c.text} />
                </div>
              </div>
            );
          })}
        </div>

        <aside className="panel zappers">
          <div className="panel-head">
            <h4>
              <IconZap /> Zappers ({pumpers.length})
            </h4>
          </div>
          {pumpers.length === 0 && <p className="faint panel-empty">No zaps yet. Be the first.</p>}
          {pumpers.map((pp, i) => {
            const masked = pp.anonymous || !pp.author;
            const name = masked ? `Anonymous zapper #${i + 1}` : pp.author!.handle;
            const sub = masked ? "wallet hidden" : `${shortWallet(pp.author!.wallet)} · ${timeAgo(pp.createdAt)} ago`;
            return (
              <div className="pumper-row" key={pp.id}>
                {masked ? (
                  <Avatar id={pp.id} handle="?" size="sm" anonymous />
                ) : (
                  <Avatar id={pp.author!.id} handle={pp.author!.handle} src={pp.author!.avatarUrl} size="sm" />
                )}
                <div className="pr-info">
                  <div className="pr-name">
                    {name}
                    {pp.isSelfPump && (
                      <span className="self-pump-tag" title="The creator zapped their own post: it extends its life but doesn't count in the leaderboards">
                        self-zap
                      </span>
                    )}
                  </div>
                  <div className="faint pr-sub">{sub}</div>
                </div>
                <span className="pr-amount">
                  <IconZap />
                  {fmtSol(pp.amount)}
                </span>
              </div>
            );
          })}
        </aside>
      </div>
    </section>
  );
}
