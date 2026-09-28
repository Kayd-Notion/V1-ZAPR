"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PostCard } from "./PostCard";
import { Avatar } from "./Avatar";
import { api } from "@/lib/api";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { fmtSol, shortWallet } from "@/lib/format";
import type { ClientPost, ClientUser } from "@/lib/client-types";

export function ProfileView({ handle }: { handle: string }) {
  const router = useRouter();
  const { user } = useSession();
  const { toast, dataVersion } = useUI();
  const [data, setData] = useState<{
    user: ClientUser;
    postsCount: number;
    active: ClientPost[];
    expiredCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .profile(handle)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Profil introuvable."));
  }, [handle, dataVersion]);

  if (error) {
    return (
      <div className="empty-state">
        <div className="ico">👤</div>
        {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="loading-state">
        <span className="spinner" style={{ color: "var(--accent)" }} /> Chargement du profil…
      </div>
    );
  }

  const u = data.user;
  const isMe = user?.id === u.id;
  const showGiven = isMe || !u.hidePumpHistory;

  return (
    <section>
      <div className="header back-bar" style={{ borderBottom: "1px solid var(--border-soft)" }}>
        <button className="back-btn" onClick={() => router.back()}>
          ←
        </button>
        <div>
          <div className="page-title" style={{ display: "block" }}>
            {u.handle}
          </div>
          <div className="faint" style={{ fontSize: 12 }}>
            {data.postsCount} posts
          </div>
        </div>
      </div>

      <div className="profile-cover" />
      <div className="profile-head">
        <div className="profile-top-row">
          <Avatar id={u.id} handle={u.handle} size="lg" />
          {isMe ? (
            <button className="btn" style={{ marginTop: 12 }} onClick={() => router.push("/settings")}>
              Modifier le profil
            </button>
          ) : (
            <button
              className="btn btn-primary"
              style={{ marginTop: 12 }}
              onClick={() => toast(`✅ Tu suis désormais ${u.handle}`)}
            >
              Suivre
            </button>
          )}
        </div>
        <div className="profile-name">{u.handle}</div>
        <div className="profile-handle">@{u.handle}</div>
        <div className="profile-bio">{u.bio}</div>
        <div className="profile-wallet">💳 {shortWallet(u.wallet)}</div>
      </div>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="sb-val accent">⚡ {fmtSol(u.received)}</div>
          <div className="sb-label">Pumps reçus</div>
        </div>
        <div className="stat-box">
          <div className="sb-val">{showGiven ? `⚡ ${fmtSol(u.given)}` : "—"}</div>
          <div className="sb-label">Pumps donnés</div>
        </div>
        <div className="stat-box">
          <div className="sb-val">{data.postsCount}</div>
          <div className="sb-label">
            Posts · {data.expiredCount} {data.expiredCount > 1 ? "expirés" : "expiré"}
          </div>
        </div>
      </div>
      {!showGiven && (
        <p className="faint" style={{ padding: "0 16px 8px", fontSize: 12 }}>
          🔒 L&apos;historique de pump est masqué (confidentialité).
        </p>
      )}

      <div className="section-title">Posts actifs</div>
      {data.active.length ? (
        data.active.map((p) => <PostCard key={p.id} post={p} />)
      ) : (
        <div className="empty-state">Aucun post actif.</div>
      )}
    </section>
  );
}
