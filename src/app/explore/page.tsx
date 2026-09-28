"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PostCard } from "@/components/PostCard";
import { api } from "@/lib/api";
import { useUI } from "@/context/UIContext";
import type { ClientPost } from "@/lib/client-types";

const TRENDS = [
  { tag: "#solana", count: "12.4k posts" },
  { tag: "#pump", count: "8.9k posts" },
  { tag: "#nft", count: "5.1k posts" },
  { tag: "#build", count: "3.3k posts" },
  { tag: "#privacy", count: "2.0k posts" },
];

function ExploreInner() {
  const params = useSearchParams();
  const { dataVersion } = useUI();
  const [all, setAll] = useState<ClientPost[]>([]);
  const [q, setQ] = useState(params.get("q") || "");

  useEffect(() => {
    api.feed("live", undefined, 50).then((r) => setAll(r.posts)).catch(() => setAll([]));
  }, [dataVersion]);

  useEffect(() => {
    setQ(params.get("q") || "");
  }, [params]);

  const query = q.trim().toLowerCase();
  const matched = useMemo(() => {
    if (!query) return [];
    return all.filter(
      (p) =>
        p.text.toLowerCase().includes(query) ||
        p.author.handle.toLowerCase().includes(query) ||
        p.tags.some((t) => t.toLowerCase().includes(query)),
    );
  }, [all, query]);

  const trending = useMemo(
    () => [...all].sort((a, b) => b.pumped - a.pumped).slice(0, 3),
    [all],
  );

  return (
    <section>
      <div className="search-wrap">
        <div className="search-box">
          <span className="s-ico">🔍</span>
          <input
            className="field"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher des posts, créateurs, tags…"
          />
        </div>
      </div>

      {query ? (
        matched.length ? (
          <>
            <div className="section-title">
              {matched.length} résultat(s) pour « {q} »
            </div>
            {matched.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </>
        ) : (
          <div className="empty-state">
            <div className="ico">🔍</div>
            Aucun résultat pour « {q} »
          </div>
        )
      ) : (
        <>
          <div className="section-title">🔥 Tendances</div>
          {TRENDS.map((t, i) => (
            <div key={t.tag} className="trend-item" onClick={() => setQ(t.tag)}>
              <div className="t-rank">Tendance {i + 1}</div>
              <div className="t-tag">{t.tag}</div>
              <div className="t-count">{t.count}</div>
            </div>
          ))}
          <div className="section-title">Posts en vogue</div>
          {trending.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </>
      )}
    </section>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="loading-state">…</div>}>
      <ExploreInner />
    </Suspense>
  );
}
