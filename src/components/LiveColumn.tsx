"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Flame, Hourglass, Sparkles } from "lucide-react";
import { Avatar } from "./Avatar";
import { ZapIcon, ZaprEmpty, ZaprLoader } from "./ZaprMark";
import { api } from "@/lib/api";
import { useLive, useNow } from "@/context/LiveContext";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { fmtSol, remainingLabel, timeAgo } from "@/lib/format";
import { lifespanInfo } from "@/lib/lifespan";
import type { ClientPost } from "@/lib/client-types";

type Tab = "new" | "dying" | "hot";

const TABS: { key: Tab; label: string; Icon: typeof Sparkles }[] = [
  { key: "new", label: "Nouveau", Icon: Sparkles },
  { key: "dying", label: "Bientôt RIP", Icon: Hourglass },
  { key: "hot", label: "En feu", Icon: Flame },
];

/**
 * Permanent live column (pump.fun "screener" style): every new post appears
 * within seconds, plus posts about to die and the most zapped of the day.
 */
export function LiveColumn({ wide = false }: { wide?: boolean }) {
  const { posts, freshIds } = useLive();
  const { dataVersion } = useUI();
  const now = useNow(1000);
  const [tab, setTab] = useState<Tab>("new");
  const [hot, setHot] = useState<ClientPost[] | null>(null);

  // "En feu": most zapped posts over 24 h (real totals from the zap log).
  useEffect(() => {
    if (tab !== "hot") return;
    let cancelled = false;
    api
      .leaderboard({ kind: "posts", scope: "world", period: "24h", limit: 30 })
      .then((r) => !cancelled && setHot(r.items.flatMap((it) => (it.post ? [it.post] : []))))
      .catch(() => !cancelled && setHot([]));
    return () => {
      cancelled = true;
    };
  }, [tab, dataVersion, posts]);

  const list = useMemo(() => {
    if (tab === "hot") return hot;
    if (!posts) return null;
    if (tab === "new") return posts;
    // Still alive, closest to expiry first.
    return posts
      .map((p) => ({ p, left: lifespanInfo(p.createdAt, p.pumped, now).remainingMs }))
      .filter((x) => x.left > 0)
      .sort((a, b) => a.left - b.left)
      .map((x) => x.p);
    // `now` only matters for the order of dying posts; refresh it with the feed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, posts, hot]);

  return (
    <aside className={`live-col${wide ? " wide" : ""}`}>
      <div className="live-head">
        <div className="live-title">
          <span className="live-dot" /> Live
        </div>
        <div className="live-tabs" role="tablist">
          {TABS.map(({ key, label, Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={`live-tab${tab === key ? " active" : ""}`}
              onClick={() => setTab(key)}
            >
              <Icon /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="live-list">
        {list === null ? (
          <ZaprLoader />
        ) : list.length === 0 ? (
          <ZaprEmpty title={tab === "hot" ? "Rien en feu aujourd'hui." : "Rien de neuf. Pour l'instant."}>
            <span>Poste un truc, le live s&apos;allume.</span>
          </ZaprEmpty>
        ) : (
          list.map((p) => <LiveCard key={p.id} post={p} now={now} fresh={freshIds.has(p.id)} />)
        )}
      </div>
    </aside>
  );
}

function LiveCard({ post, now, fresh }: { post: ClientPost; now: number; fresh: boolean }) {
  const router = useRouter();
  const { openPump } = useUI();
  const { requireAuth } = useSession();
  const info = lifespanInfo(post.createdAt, post.pumped, now);

  const zap = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!requireAuth("Connecte ton wallet pour envoyer un zap.")) return;
    openPump(post);
  };

  return (
    <article className={`lcard${fresh ? " fresh" : ""}`} onClick={() => router.push(`/post/${post.id}`)}>
      <div className="lc-thumb">
        {post.mediaUrl && post.mediaType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.mediaUrl} alt="" loading="lazy" />
        ) : (
          <Avatar id={post.author.id} handle={post.author.handle} />
        )}
      </div>
      <div className="lc-body">
        <div className="lc-head">
          <span className="lc-handle">@{post.author.handle}</span>
          <span className="lc-age">{timeAgo(post.createdAt, now)}</span>
        </div>
        <div className="lc-text">{post.text}</div>
        <div className="lc-meta">
          <div className="lc-bar">
            <div className={`tg-fill ${info.cls}`.trim()} style={{ width: `${info.pct}%` }} />
          </div>
          <span className={`lc-left${info.expired ? " rip" : ""}`}>{remainingLabel(info.remainingMs)}</span>
        </div>
      </div>
      <div className="lc-side">
        <span className="lc-amount">
          <ZapIcon />
          {fmtSol(post.pumped)}
        </span>
        {!post.deleted && (
          <button className="lc-zap" onClick={zap} aria-label="Envoyer un zap">
            <ZapIcon /> Zap
          </button>
        )}
      </div>
    </article>
  );
}
