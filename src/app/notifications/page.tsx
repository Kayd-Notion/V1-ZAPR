"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, UserPlus } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ZapIcon, ZaprEmpty, ZaprLoader } from "@/components/ZaprMark";
import { api } from "@/lib/api";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useNow } from "@/context/LiveContext";
import { fmtSol, timeAgo } from "@/lib/format";
import type { ClientNotification } from "@/lib/client-types";

export default function NotificationsPage() {
  const { user } = useSession();
  const { openConnect } = useUI();
  const { unread, markSeen } = useNotifications();
  const [items, setItems] = useState<ClientNotification[] | null>(null);
  // Items newer than this were unseen when the list was opened: highlighted.
  const [seenAt, setSeenAt] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await api.notifications();
      setItems(res.items);
      setCursor(res.nextCursor);
      // Keep the highlight from the first opening while new ones stream in.
      if (firstLoad.current) setSeenAt(res.seenAt);
      firstLoad.current = false;
      await markSeen();
    } catch {
      setItems((prev) => prev ?? []);
    }
  }, [markSeen]);

  useEffect(() => {
    if (!user) return;
    firstLoad.current = true;
    setItems(null);
    load();
  }, [user?.id, load]); // eslint-disable-line react-hooks/exhaustive-deps

  // Something new arrived while the page is open: show it right away.
  useEffect(() => {
    if (user && unread > 0 && items !== null) load();
  }, [unread]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.notifications(cursor);
      setItems((prev) => [...(prev ?? []), ...res.items]);
      setCursor(res.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  if (!user) {
    return (
      <ZaprEmpty title="No wallet, no notifications.">
        <button className="btn btn-primary" onClick={() => openConnect("Connect your wallet to see your notifications.")}>
          Connect
        </button>
      </ZaprEmpty>
    );
  }

  return (
    <section>
      <div className="subbar">
        <div className="page-title">Notifications</div>
      </div>
      {items === null ? (
        <ZaprLoader label="Loading notifications…" />
      ) : items.length === 0 ? (
        <ZaprEmpty title="Nothing yet.">
          <span>Zaps, new followers and comments on your posts land here.</span>
        </ZaprEmpty>
      ) : (
        <>
          {items.map((n) => (
            <NotificationRow key={n.id} n={n} fresh={n.createdAt > seenAt} />
          ))}
          {cursor && (
            <div className="notif-more">
              <button className="btn btn-sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function NotificationRow({ n, fresh }: { n: ClientNotification; fresh: boolean }) {
  const router = useRouter();
  const now = useNow(30_000);
  const who = n.actor ? `@${n.actor.handle}` : "An anonymous zapper";
  const zap = n.kind === "post_zap" || n.kind === "creator_zap";

  let action: string;
  if (n.kind === "post_zap") action = "zapped your post";
  else if (n.kind === "creator_zap") action = "zapped you directly";
  else if (n.kind === "follow") action = "started following you";
  else action = "commented on your post";

  // Where a click goes: the post if it is still alive, else the person.
  const href = n.postId ? `/post/${n.postId}` : n.actor ? `/profile/${n.actor.handle}` : null;
  const Icon = n.kind === "follow" ? UserPlus : n.kind === "comment" ? MessageCircle : ZapIcon;

  return (
    <div
      className={`notif-row${fresh ? " fresh" : ""}${href ? " link" : ""}`}
      onClick={() => href && router.push(href)}
    >
      <div className="notif-avatar">
        {n.actor ? (
          <Avatar id={n.actor.id} handle={n.actor.handle} size="sm" />
        ) : (
          <Avatar id={n.id} handle="?" size="sm" anonymous />
        )}
        <span className={`notif-kind k-${n.kind}`}>
          <Icon />
        </span>
      </div>
      <div className="notif-body">
        <div className="notif-line">
          <b>{who}</b> {action}
          <span className="notif-time">{timeAgo(n.createdAt, now)} ago</span>
        </div>
        {n.kind === "comment" && n.text && <div className="notif-quote">&ldquo;{n.text}&rdquo;</div>}
        {(n.kind === "post_zap" || n.kind === "comment") && (
          <div className="notif-post">{n.postText ?? "A post that has expired since."}</div>
        )}
      </div>
      {zap && n.amount !== null && (
        <span className="notif-amount">
          <ZapIcon />+{fmtSol(n.amount)}
        </span>
      )}
      {fresh && <span className="notif-dot" aria-label="New" />}
    </div>
  );
}
