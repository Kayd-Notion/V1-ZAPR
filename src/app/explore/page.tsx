"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Flame, Search } from "lucide-react";
import { PostCard } from "@/components/PostCard";
import { ZaprEmpty, ZaprLoader } from "@/components/ZaprMark";
import { api } from "@/lib/api";
import { useUI } from "@/context/UIContext";
import type { ClientPost } from "@/lib/client-types";

function ExploreInner() {
  const params = useSearchParams();
  const { dataVersion } = useUI();
  const [all, setAll] = useState<ClientPost[]>([]);
  const [q, setQ] = useState(params.get("q") || "");

  useEffect(() => {
    api.feed(undefined, 50).then((r) => setAll(r.posts)).catch(() => setAll([]));
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
    () => [...all].sort((a, b) => b.pumped - a.pumped).slice(0, 10),
    [all],
  );

  return (
    <section>
      <div className="search-wrap">
        <div className="search-box">
          <Search className="s-ico" />
          <input
            className="field"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search posts, degens, #tags…"
            aria-label="Search"
            autoFocus
          />
        </div>
      </div>

      {query ? (
        matched.length ? (
          <>
            <div className="section-title">
              {matched.length} result{matched.length > 1 ? "s" : ""} for &ldquo;{q}&rdquo;
            </div>
            {matched.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </>
        ) : (
          <ZaprEmpty title={`Nothing for "${q}".`}>
            <span>Try another word, or a #tag.</span>
          </ZaprEmpty>
        )
      ) : (
        <>
          <div className="section-title">
            <Flame /> On fire
          </div>
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
    <Suspense fallback={<ZaprLoader />}>
      <ExploreInner />
    </Suspense>
  );
}
