"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { api } from "@/lib/api";
import { useUI } from "@/context/UIContext";
import { fmtSol } from "@/lib/format";
import type { LeaderboardCreatorItem } from "@/lib/client-types";

export function RightRail() {
  const router = useRouter();
  const { dataVersion } = useUI();
  const [creators, setCreators] = useState<LeaderboardCreatorItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .leaderboard({ kind: "creators", scope: "world", period: "all", limit: 3 })
      .then((res) => {
        if (!cancelled) setCreators(res.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [dataVersion]);

  return (
    <aside className="right-rail">
      <div className="rail-card">
        <h4>🏆 Top créateurs</h4>
        {creators.map(({ user: u, total }, i) => (
          <div
            key={u.id}
            className="lb-row"
            style={{ padding: "8px 0", border: "none" }}
            onClick={() => router.push(`/profile/${u.handle}`)}
          >
            <div className="lb-rank" style={{ width: 20, fontSize: 14 }}>
              {i + 1}
            </div>
            <Avatar id={u.id} handle={u.handle} size="sm" />
            <div className="lb-info">
              <div className="lb-name" style={{ fontSize: 13.5 }}>
                {u.handle}
              </div>
              <div className="lb-sub">@{u.handle}</div>
            </div>
            <div className="lb-amount" style={{ fontSize: 13 }}>
              ⚡{fmtSol(total)}
            </div>
          </div>
        ))}
      </div>
      <p className="faint" style={{ fontSize: 12, padding: "0 4px" }}>
        Réseau : devnet (aucune transaction sur mainnet). © ZAPR
      </p>
    </aside>
  );
}
