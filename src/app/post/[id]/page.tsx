"use client";
import { use, useCallback, useEffect, useState } from "react";
import { ArrowLeft, MessageCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { TimeGauge } from "@/components/TimeGauge";
import { ZapIcon, ZaprEmpty, ZaprLoader } from "@/components/ZaprMark";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { useLive, useNow } from "@/context/LiveContext";
import { api } from "@/lib/api";
import { fmtSol, shortWallet, timeAgo } from "@/lib/format";
import { lifespanInfo } from "@/lib/lifespan";
import type { ClientComment, ClientPost, ClientPumper } from "@/lib/client-types";

export default function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { requireAuth } = useSession();
  const { openPump, toast, dataVersion } = useUI();

  const [post, setPost] = useState<ClientPost | null>(null);
  const [pumpers, setPumpers] = useState<ClientPumper[]>([]);
  const [comments, setComments] = useState<ClientComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [notFound, setNotFound] = useState(false);

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
      <ZaprEmpty title="Post introuvable.">
        <span>Il a peut-être été supprimé. Ou il n&apos;a jamais existé.</span>
      </ZaprEmpty>
    );
  }
  if (!post) return <ZaprLoader label="Chargement…" />;

  // Expired posts are deleted: if it dies while open, say so.
  if (lifespanInfo(post.createdAt, post.pumped, now).expired) {
    return (
      <ZaprEmpty title="Trop tard, ce post a expiré.">
        <span>Il a été supprimé. Aucun zap ne l&apos;a sauvé à temps.</span>
      </ZaprEmpty>
    );
  }

  const submitComment = async () => {
    if (!requireAuth("Connecte ton wallet pour commenter.")) return;
    const v = commentText.trim();
    if (!v) return;
    try {
      const res = await api.addComment(post.id, v);
      setComments(res.comments);
      setCommentText("");
      setPost({ ...post, comments: post.comments + 1 });
      toast("Commentaire posté.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Envoi impossible.");
    }
  };

  const doPump = () => {
    if (!requireAuth("Connecte ton wallet pour envoyer un zap.")) return;
    openPump(post);
  };

  return (
    <section>
      <div className="subbar">
        <button className="icon-btn" onClick={() => router.push("/")} aria-label="Retour">
          <ArrowLeft />
        </button>
        <div className="page-title">Post</div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <div className="detail-post">
            <div className="dp-head">
              <Avatar id={post.author.id} handle={post.author.handle} />
              <div style={{ cursor: "pointer" }} onClick={() => router.push(`/profile/${post.author.handle}`)}>
                <div className="name">{post.author.handle}</div>
                <div className="faint">
                  @{post.author.handle} · il y a {timeAgo(post.createdAt)}
                </div>
              </div>
            </div>

            {post.deleted ? (
              <div className="dp-text faint" style={{ fontStyle: "italic" }}>
                Ce post a expiré et son contenu a été supprimé.
              </div>
            ) : (
              <div className="dp-text">{post.text}</div>
            )}

            {post.mediaUrl && (
              <div className={`post-media${post.mediaType === "video" ? " video" : ""}`}>
                {post.mediaType === "video" ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={post.mediaUrl} controls />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.mediaUrl} alt="" />
                )}
              </div>
            )}

            <div className="post-stats">
              <TimeGauge createdAt={post.createdAt} pumped={post.pumped} />
              <div className="pumped-badge">
                <span className="pb-amount">
                  <ZapIcon />
                  {fmtSol(post.pumped)}
                </span>
                <span className="pb-label">SOL en zaps</span>
              </div>
            </div>

            {post.deleted ? (
              // Rule 2.1: a purged post can't be zapped — no Zap button at all.
              <div className="pump-notice" style={{ marginBottom: 0 }}>
                <b className="notice-title">
                  <Trash2 /> Post supprimé
                </b>
                Il a expiré et son contenu a été supprimé : il ne peut plus recevoir de zaps.
              </div>
            ) : (
              <button className="pump-btn pump-btn-lg" onClick={doPump}>
                <ZapIcon /> Envoyer un zap
              </button>
            )}
          </div>

          <div className="section-title">
            <MessageCircle /> Commentaires ({comments.length})
          </div>
          <div className="comment-form">
            <input
              className="field"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder="Dis un truc…"
              maxLength={300}
            />
            <button className="btn btn-primary" onClick={submitComment}>
              Envoyer
            </button>
          </div>
          {comments.map((c) => (
            <div className="comment" key={c.id}>
              <Avatar id={c.author.id} handle={c.author.handle} size="sm" />
              <div className="c-body">
                <div className="c-head">
                  <span className="name">{c.author.handle}</span>
                  <span className="faint">il y a {timeAgo(c.createdAt)}</span>
                </div>
                <div className="c-text">{c.text}</div>
              </div>
            </div>
          ))}
        </div>

        <aside className="panel zappers">
          <div className="panel-head">
            <h4>
              <ZapIcon /> Zappeurs ({pumpers.length})
            </h4>
          </div>
          {pumpers.length === 0 && <p className="faint panel-empty">Aucun zap pour l&apos;instant. Ouvre le bal.</p>}
          {pumpers.map((pp, i) => {
            const masked = pp.anonymous || !pp.author;
            const name = masked ? `Zappeur anonyme #${i + 1}` : pp.author!.handle;
            const sub = masked ? "wallet masqué" : `${shortWallet(pp.author!.wallet)} · il y a ${timeAgo(pp.createdAt)}`;
            return (
              <div className="pumper-row" key={pp.id}>
                {masked ? (
                  <Avatar id={pp.id} handle="?" size="sm" anonymous />
                ) : (
                  <Avatar id={pp.author!.handle} handle={pp.author!.handle} size="sm" />
                )}
                <div className="pr-info">
                  <div className="pr-name">
                    {name}
                    {pp.isSelfPump && (
                      <span className="self-pump-tag" title="Le créateur s'est envoyé un zap sur son propre post">
                        auto-zap
                      </span>
                    )}
                  </div>
                  <div className="faint pr-sub">{sub}</div>
                </div>
                <span className="pr-amount">
                  <ZapIcon />
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
