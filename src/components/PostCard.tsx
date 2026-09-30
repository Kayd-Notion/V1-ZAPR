"use client";
import { useRouter } from "next/navigation";
import { IconComment, IconLink, IconZap } from "@/components/icons";
import { Avatar } from "./Avatar";
import { TimeGauge } from "./TimeGauge";

import { useUI } from "@/context/UIContext";
import { useSession } from "@/context/SessionContext";
import { useNow } from "@/context/LiveContext";
import { fmtSol, timeAgo } from "@/lib/format";
import { lifespanInfo } from "@/lib/lifespan";
import type { ClientPost } from "@/lib/client-types";

export function PostCard({ post, fresh = false }: { post: ClientPost; fresh?: boolean }) {
  const router = useRouter();
  const { openPump, toast } = useUI();
  const { requireAuth } = useSession();

  // Expired posts are deleted: one that expires while on screen disappears.
  const now = useNow(10_000);
  if (lifespanInfo(post.createdAt, post.pumped, now).expired) return null;

  const go = () => router.push(`/post/${post.id}`);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const doPump = () => {
    if (!requireAuth("Connect your wallet to send a zap.")) return;
    openPump(post);
  };
  const copyLink = () => {
    const url = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard?.writeText(url).then(
      () => toast("Link copied. Go shill it."),
      () => toast(url),
    );
  };

  return (
    <article className={`post${fresh ? " fresh" : ""}`} onClick={go}>
      <div onClick={stop}>
        <button className="avatar-link" onClick={() => router.push(`/profile/${post.author.handle}`)}>
          <Avatar id={post.author.id} handle={post.author.handle} />
        </button>
      </div>
      <div className="post-body">
        <div className="post-head">
          <span className="name">{post.author.handle}</span>
          <span className="time">{timeAgo(post.createdAt)} ago</span>
        </div>
        <div className="post-text">{post.text}</div>

        {post.mediaUrl && (
          <div className={`post-media${post.mediaType === "video" ? " video" : ""}`}>
            {post.mediaType === "video" ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={post.mediaUrl} preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.mediaUrl} alt="" loading="lazy" />
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

        <div className="post-actions" onClick={stop}>
          <button className="pa-btn" onClick={go} title="Comments">
            <IconComment />
            <span>{post.comments}</span>
          </button>
          <button className="pa-btn" onClick={copyLink} title="Copy link">
            <IconLink />
          </button>
          {!post.deleted && (
            <button className="pump-btn" onClick={doPump}>
              <IconZap /> Zap
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
