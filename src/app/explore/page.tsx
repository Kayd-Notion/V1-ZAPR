"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { IconFlame, IconSearch, IconUsers } from "@/components/icons";
import { Avatar } from "@/components/Avatar";
import { PostCard } from "@/components/PostCard";
import { ZaprEmpty, ZaprLoader } from "@/components/ZaprMark";
import { api } from "@/lib/api";
import { useUI } from "@/context/UIContext";
import type { ClientPost, ClientUser } from "@/lib/client-types";

function ExploreInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { dataVersion } = useUI();
  const [all, setAll] = useState<ClientPost[]>([]);
  const [q, setQ] = useState(params.get("q") || "");
  const [results, setResults] = useState<{ q: string; posts: ClientPost[]; users: ClientUser[] } | null>(null);

  // "On fire" when nothing is typed: the most zapped of the latest posts.
  useEffect(() => {
    api.feed(undefined, 50).then((r) => setAll(r.posts)).catch(() => setAll([]));
  }, [dataVersion]);

  // A #tag link or Back changes the URL: follow it (but never rewrite what is
  // being typed, e.g. a trailing space).
  useEffect(() => {
    const pq = params.get("q") || "";
    setQ((cur) => (cur.trim() === pq.trim() ? cur : pq));
  }, [params]);

  // Server search (every live post, every user), a moment after typing stops.
  const query = q.trim();
  useEffect(() => {
    if (!query) {
      setResults(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .search(query)
        .then((r) => !cancelled && setResults({ q: query, ...r }))
        .catch(() => !cancelled && setResults({ q: query, posts: [], users: [] }));
      // Keep the query in the URL: shareable, and Back returns to it.
      router.replace(`/explore?q=${encodeURIComponent(query)}`, { scroll: false });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, dataVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const trending = useMemo(() => [...all].sort((a, b) => b.pumped - a.pumped).slice(0, 10), [all]);

  const loading = query && results?.q !== query;
  const empty = results && results.q === query && results.posts.length === 0 && results.users.length === 0;

  return (
    <section>
      <div className="search-wrap">
        <div className="search-box">
          <IconSearch className="s-ico" />
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

      {!query ? (
        <>
          <div className="section-title">
            <IconFlame /> On fire
          </div>
          {trending.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </>
      ) : loading && !results ? (
        <ZaprLoader label="Searching…" />
      ) : empty ? (
        <ZaprEmpty title={`Nothing for "${query}".`}>
          <span>Try another word, a #tag or a @username.</span>
        </ZaprEmpty>
      ) : results ? (
        <>
          {results.users.length > 0 && (
            <>
              <div className="section-title">
                <IconUsers /> Degens
              </div>
              <div className="search-users">
                {results.users.map((u) => (
                  <Link key={u.id} href={`/profile/${u.handle}`} className="su-row">
                    <Avatar id={u.id} handle={u.handle} src={u.avatarUrl} size="sm" />
                    <span className="su-text">
                      <b>@{u.handle}</b>
                      <small>{u.bio}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}
          {results.posts.length > 0 && (
            <>
              <div className="section-title">
                {results.posts.length} post{results.posts.length > 1 ? "s" : ""} for &ldquo;{results.q}&rdquo;
              </div>
              {results.posts.map((p) => (
                <PostCard key={p.id} post={p} />
              ))}
            </>
          )}
        </>
      ) : null}
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
