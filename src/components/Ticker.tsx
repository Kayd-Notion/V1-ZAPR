"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "./Avatar";
import { ZapIcon } from "./ZaprMark";
import { api } from "@/lib/api";
import { useUI } from "@/context/UIContext";
import { fmtSol } from "@/lib/format";
import type { LeaderboardCreatorItem } from "@/lib/client-types";

const REFRESH_MS = 60_000;

/** Scrolling band of the creators who received the most zaps (24 h, else all time). */
export function Ticker() {
  const { dataVersion } = useUI();
  const [items, setItems] = useState<LeaderboardCreatorItem[]>([]);
  const [period, setPeriod] = useState<"24h" | "all">("24h");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        let res = await api.leaderboard({ kind: "creators", scope: "world", period: "24h", limit: 15 });
        let p: "24h" | "all" = "24h";
        if (res.items.length === 0) {
          res = await api.leaderboard({ kind: "creators", scope: "world", period: "all", limit: 15 });
          p = "all";
        }
        if (!cancelled) {
          setItems(res.items);
          setPeriod(p);
        }
      } catch {
        /* keep the previous band */
      }
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [dataVersion]);

  const content =
    items.length > 0 ? (
      items.map(({ user: u, total }) => (
        <Link key={u.id} href={`/profile/${u.handle}`} className="tk-item">
          <Avatar id={u.id} handle={u.handle} size="xs" />
          <span className="tk-handle">@{u.handle}</span>
          <span className="tk-amount">
            <ZapIcon />+{fmtSol(total)} SOL
          </span>
        </Link>
      ))
    ) : (
      <>
        {["ZAPR est live sur devnet", "Poste. Zappe. Grimpe.", "Les posts meurent en 24 h sans zaps", "Sois le premier sur le leaderboard"].map(
          (t) => (
            <span key={t} className="tk-item">
              <ZapIcon />
              <span className="tk-handle">{t}</span>
            </span>
          ),
        )}
      </>
    );

  return (
    <div className="ticker" aria-label={period === "24h" ? "Top zappés sur 24 h" : "Top zappés"}>
      <span className="tk-label">{period === "24h" ? "Top 24h" : "Top"}</span>
      <div className="tk-viewport">
        {/* Rendered twice so the loop is seamless. */}
        <div className="tk-track">
          <div className="tk-run">{content}</div>
          <div className="tk-run" aria-hidden="true">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
