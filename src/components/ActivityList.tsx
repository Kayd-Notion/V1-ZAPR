"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { IconArrowIn, IconArrowOut, IconExternal } from "@/components/icons";
import { ZaprLoader } from "@/components/ZaprMark";
import { api } from "@/lib/api";
import { useUI } from "@/context/UIContext";
import { useNow } from "@/context/LiveContext";
import { formatSol } from "@/lib/pump-rules";
import { timeAgo } from "@/lib/format";
import { explorerTxUrl } from "@/lib/solana";
import type { ActivityFilter, ClientActivity } from "@/lib/client-types";

const TABS: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "in", label: "Received" },
  { id: "out", label: "Sent" },
];

/** Wallet → Activity: every zap the user sent, and every share they received. */
export function ActivityList() {
  const { dataVersion } = useUI();
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [items, setItems] = useState<ClientActivity[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (f: ActivityFilter) => {
    setItems(null);
    try {
      const r = await api.activity(f);
      setItems(r.items);
      setCursor(r.nextCursor);
    } catch {
      setItems([]);
      setCursor(null);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [filter, dataVersion, load]);

  const more = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await api.activity(filter, cursor);
      setItems((prev) => [...(prev ?? []), ...r.items]);
      setCursor(r.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="activity">
      <div className="activity-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={filter === t.id}
            className={`chip${filter === t.id ? " active" : ""}`}
            onClick={() => setFilter(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {items === null ? (
        <ZaprLoader label="Loading your activity…" />
      ) : items.length === 0 ? (
        <p className="faint activity-empty">
          {filter === "out"
            ? "You haven't zapped anyone yet."
            : filter === "in"
              ? "No zaps received yet. Post something worth it."
              : "Nothing yet. Your zaps, sent and received, will show up here."}
        </p>
      ) : (
        <>
          {items.map((a) => (
            <ActivityRow key={a.id} a={a} />
          ))}
          {cursor && (
            <div className="notif-more">
              <button className="btn btn-sm" onClick={more} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Who({ a }: { a: ClientActivity }) {
  if (!a.counterpart) return <b>An anonymous zapper</b>;
  return (
    <Link href={`/profile/${a.counterpart.handle}`}>
      <b>@{a.counterpart.handle}</b>
    </Link>
  );
}

function ActivityRow({ a }: { a: ClientActivity }) {
  const now = useNow(30_000);
  const inbound = a.direction === "in";
  const share = a.total > 0 ? Math.round((a.amount / a.total) * 100) : 0;

  let line: React.ReactNode;
  let sub: string | null = null;
  switch (a.kind) {
    case "zap_sent":
      line = a.self ? (
        <>You zapped your own post</>
      ) : (
        <>
          You zapped <Who a={a} />
          &apos;s post
        </>
      );
      sub = a.postText ?? "A post that has expired since.";
      break;
    case "creator_zap_sent":
      line = (
        <>
          You zapped <Who a={a} /> directly
        </>
      );
      break;
    case "zap_received":
      line = a.self ? (
        <>Your share of your self-zap</>
      ) : (
        <>
          <Who a={a} /> zapped your post
        </>
      );
      sub = `Your ${share}% of ${formatSol(a.total)} SOL${a.postText ? ` · ${a.postText}` : ""}`;
      break;
    case "creator_zap_received":
      line = (
        <>
          <Who a={a} /> zapped you directly
        </>
      );
      sub = `Your ${share}% of ${formatSol(a.total)} SOL`;
      break;
  }

  return (
    <div className={`act-row ${inbound ? "in" : "out"}`}>
      <span className="act-ico">{inbound ? <IconArrowIn /> : <IconArrowOut />}</span>
      <div className="act-body">
        <div className="act-line">{line}</div>
        {sub &&
          (a.postId ? (
            <Link href={`/post/${a.postId}`} className="act-sub">
              {sub}
            </Link>
          ) : (
            <div className="act-sub">{sub}</div>
          ))}
      </div>
      <div className="act-side">
        <span className="act-amount">
          {inbound ? "+" : "−"}
          {formatSol(a.amount)} SOL
        </span>
        <span className="act-meta">
          {timeAgo(a.createdAt, now)} ago
          <a href={explorerTxUrl(a.signature)} target="_blank" rel="noreferrer" title="View the transaction" aria-label="View the transaction on the explorer">
            <IconExternal />
          </a>
        </span>
      </div>
    </div>
  );
}
