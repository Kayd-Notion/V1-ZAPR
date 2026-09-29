"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown } from "lucide-react";
import { Avatar } from "./Avatar";
import { ZapIcon } from "./ZaprMark";
import { api } from "@/lib/api";
import { useUI } from "@/context/UIContext";
import { fmtSol } from "@/lib/format";
import type { LeaderboardCreatorItem, LeaderboardPeriod } from "@/lib/client-types";

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "24h", label: "24h" },
  { key: "7d", label: "7j" },
  { key: "all", label: "Tout" },
];

/** Home side panel: creators who received the most zaps (pump.fun "Top traders"). */
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
          <Crown /> Top degens
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
        <p className="faint panel-empty">Personne sur le podium. La place est libre.</p>
      ) : (
        items.map(({ user: u, total }, i) => (
          <Link key={u.id} href={`/profile/${u.handle}`} className={`td-row${i < 3 ? " top" + (i + 1) : ""}`}>
            <span className="td-rank">{i + 1}</span>
            <Avatar id={u.id} handle={u.handle} size="sm" />
            <span className="td-handle">{u.handle}</span>
            <span className="td-amount">
              <ZapIcon />+{fmtSol(total)}
            </span>
          </Link>
        ))
      )}
      <Link href="/leaderboard" className="btn btn-block btn-sm panel-more">
        Voir tout le classement
      </Link>
    </aside>
  );
}
