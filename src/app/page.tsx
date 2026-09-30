"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconGlobe, IconUsers } from "@/components/icons";
import { PostCard } from "@/components/PostCard";
import { TopDegens } from "@/components/TopDegens";
import { ZaprEmpty, ZaprLoader, ZaprMark } from "@/components/ZaprMark";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { useLive } from "@/context/LiveContext";
import { api } from "@/lib/api";
import type { ClientPost } from "@/lib/client-types";

type Tab = "all" | "following";

export default function FeedPage() {
  const { user, requireAuth } = useSession();
  const { openConnect, dataVersion } = useUI();
  const live = useLive();
  const [tab, setTab] = useState<Tab>("all");
  // Creators the user follows ("Following"): null until loaded.
  const [followingIds, setFollowingIds] = useState<Set<string> | null>(null);
  const [posts, setPosts] = useState<ClientPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const following = tab === "following";

  // Back to "All" when the user signs out.
  useEffect(() => {
    if (!user) setTab("all");
  }, [user]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setDone(false);
    try {
      if (following) {
        const { ids } = await api.followingIds();
        setFollowingIds(new Set(ids));
      }
      const res = await api.feed(undefined, 20, following);
      setPosts(res.posts);
      setCursor(res.nextCursor);
      setDone(res.nextCursor === null);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [following]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial, dataVersion]);

  // Live: posts published since the page loaded slide in at the top (only
  // from followed creators on "Following"), and the zap totals of the posts
  // already shown stay up to date.
  useEffect(() => {
    if (!live.posts || loading) return;
    if (following && !followingIds) return;
    setPosts((prev) => {
      const latest = new Map(live.posts!.map((p) => [p.id, p]));
      const newest = prev[0]?.createdAt ?? 0;
      const shown = new Set(prev.map((p) => p.id));
      const arrived = live.posts!.filter(
        (p) => !shown.has(p.id) && p.createdAt > newest && (!following || followingIds!.has(p.userId)),
      );
      return [...arrived, ...prev.map((p) => latest.get(p.id) ?? p)];
    });
  }, [live.posts, loading, following, followingIds]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || done || cursor === null) return;
    loadingRef.current = true;
    try {
      const res = await api.feed(cursor, 20, following);
      setPosts((prev) => [...prev, ...res.posts]);
      setCursor(res.nextCursor);
      if (res.nextCursor === null) setDone(true);
    } finally {
      loadingRef.current = false;
    }
  }, [cursor, done, following]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), {
      rootMargin: "400px",
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  const pickTab = (t: Tab) => {
    if (t === "following" && !requireAuth("Connect your wallet to see who you follow.")) return;
    setTab(t);
  };

  return (
    <div className="home-grid">
      <TopDegens />
      <section className="feed">
        {!user && (
          <div className="visitor-banner">
            {/* Grey bolt: not lit yet — connecting the wallet "turns it on". */}
            <ZaprMark className="vb-mark" />
            <div className="vb-text">
              <b>You&apos;re just watching.</b>
              Connect your wallet to light the bolt: post, send zaps and climb the leaderboard.
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => openConnect("Connect your Solana wallet to enter the arena.")}
            >
              Connect
            </button>
          </div>
        )}
        <div className="feed-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "all"} className={`feed-tab${tab === "all" ? " active" : ""}`} onClick={() => pickTab("all")}>
            <IconGlobe /> All
          </button>
          <button
            role="tab"
            aria-selected={tab === "following"}
            className={`feed-tab${tab === "following" ? " active" : ""}`}
            onClick={() => pickTab("following")}
          >
            <IconUsers /> Following
          </button>
        </div>

        {loading ? (
          <ZaprLoader label="Loading the feed…" />
        ) : posts.length === 0 ? (
          following ? (
            followingIds && followingIds.size === 0 ? (
              <ZaprEmpty title="You don't follow anyone. Yet.">
                <span>Find degens to follow in the Top. It&apos;s free.</span>
                <Link href="/leaderboard" className="btn btn-primary">
                  See the Top
                </Link>
              </ZaprEmpty>
            ) : (
              <ZaprEmpty title="Nothing new from the degens you follow.">
                <span>Their next posts will land here live.</span>
              </ZaprEmpty>
            )
          ) : (
            <ZaprEmpty title="It's quiet. Too quiet.">
              <span>Be the first to post. The first zap is yours.</span>
            </ZaprEmpty>
          )
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} fresh={live.freshIds.has(p.id)} />)
        )}
        <div ref={sentinel} />
        {done && posts.length > 0 && <p className="feed-end">You&apos;ve seen it all. Go touch grass.</p>}
      </section>
    </div>
  );
}
