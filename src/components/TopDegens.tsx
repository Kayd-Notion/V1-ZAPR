"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { IconCrown, IconZap } from "@/components/icons";
import { Avatar } from "./Avatar";

import { api } from "@/lib/api";
import { useUI } from "@/context/UIContext";
import { fmtSol } from "@/lib/format";
import type { LeaderboardCreatorItem, LeaderboardPeriod } from "@/lib/client-types";

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7d" },
  { key: "all", label: "All" },
];

/** Home side panel: the most zapped creators (pump.fun "Top traders"). */
export function TopDegens() {
  const { dataVersion } = useUI();
  const [period, setPeriod] = useState<LeaderboardPeriod>("all");
  const [items, setItems] = useState<LeaderboardCreatorItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    api
      .leaderboard({ kind: "creators", scope: "world", period, limit: 20 })
      .then((r) => !cancelled && setItems(r.items))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [period, dataVersion]);

  return (
    <aside className="panel top-degens">
      <div className="panel-head">
        <h4>
          <IconCrown /> Top degens
        </h4>
        <div className="seg seg-sm">
          {PERIODS.map((p) => (
            <button key={p.key} className={`chip${period === p.key ? " active" : ""}`} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      {items === null ? null : items.length === 0 ? (
        <p className="faint panel-empty">Nobody on the podium. The spot is yours.</p>
      ) : (
        items.map(({ user: u, total }, i) => (
          <Link key={u.id} href={`/profile/${u.handle}`} className={`td-row${i < 3 ? " top" + (i + 1) : ""}`}>
            <span className="td-rank">{i + 1}</span>
            <Avatar id={u.id} handle={u.handle} src={u.avatarUrl} size="sm" />
            <span className="td-handle">{u.handle}</span>
            <span className="td-amount">
              <IconZap />+{fmtSol(total)}
            </span>
          </Link>
        ))
      )}
      <Link href="/leaderboard" className="btn btn-block btn-sm panel-more">
        See the full leaderboard
      </Link>
    </aside>
  );
}
