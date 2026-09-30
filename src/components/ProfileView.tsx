"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, EyeOff, UserCheck, UserPlus, Wallet } from "lucide-react";
import { PostCard } from "./PostCard";
import { Avatar } from "./Avatar";
import { ZapIcon, ZaprEmpty, ZaprLoader } from "./ZaprMark";
import { api } from "@/lib/api";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { fmtSol, shortWallet } from "@/lib/format";
import type { ClientPost, ClientUser } from "@/lib/client-types";
import type { FollowStats } from "@/lib/api-types";

export function ProfileView({ handle }: { handle: string }) {
  const router = useRouter();
  const { user, requireAuth } = useSession();
  const { dataVersion, openCreatorZap, toast } = useUI();
  const [data, setData] = useState<{
    user: ClientUser;
    postsCount: number;
    active: ClientPost[];
    follow: FollowStats;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .profile(handle)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Profil introuvable."));
    // Refetch when the viewer changes: "isFollowing" depends on who is looking.
  }, [handle, dataVersion, user?.id]);

  if (error) {
    return (
      <ZaprEmpty title="Profil introuvable.">
        <span>{error}</span>
      </ZaprEmpty>
    );
  }
  if (!data) {
    return <ZaprLoader label="Chargement du profil…" />;
  }

  const u = data.user;
  const isMe = user?.id === u.id;
  const showGiven = isMe || !u.hidePumpHistory;
  const follow = data.follow;

  const toggleFollow = async () => {
    if (!requireAuth("Connecte ton wallet pour suivre ce créateur.")) return;
    setFollowBusy(true);
    try {
      const next = follow.isFollowing ? await api.unfollow(u.handle) : await api.follow(u.handle);
      setData((d) => (d ? { ...d, follow: next } : d));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setFollowBusy(false);
    }
  };

  const zapCreator = () => {
    if (!requireAuth("Connecte ton wallet pour zapper ce créateur.")) return;
    openCreatorZap(u);
  };

  return (
    <section>
      <div className="subbar">
        <button className="icon-btn" onClick={() => router.back()} aria-label="Retour">
          <ArrowLeft />
        </button>
        <div>
          <div className="page-title">{u.handle}</div>
          <div className="faint" style={{ fontSize: 12 }}>
            {data.postsCount} posts
          </div>
        </div>
      </div>

      <div className="profile-cover">
        <ZapIcon className="cover-mark" />
      </div>
      <div className="profile-head">
        <div className="profile-top-row">
          <Avatar id={u.id} handle={u.handle} size="lg" />
          {isMe ? (
            <button className="btn" style={{ marginTop: 12 }} onClick={() => router.push("/settings")}>
              Modifier le profil
            </button>
          ) : (
            <div className="profile-actions">
              <button
                className={`btn${follow.isFollowing ? "" : " btn-accent-soft"}`}
                onClick={toggleFollow}
                disabled={followBusy}
                aria-pressed={follow.isFollowing}
              >
                {follow.isFollowing ? <UserCheck /> : <UserPlus />}
                {follow.isFollowing ? "Suivi" : "Suivre"}
              </button>
              <button className="btn btn-primary" onClick={zapCreator}>
                <ZapIcon /> Zap ce créateur
              </button>
            </div>
          )}
        </div>
        <div className="profile-name">{u.handle}</div>
        <div className="profile-handle">@{u.handle}</div>
        <div className="profile-bio">{u.bio}</div>
        <div className="profile-follow">
          <span>
            <b>{follow.followers}</b> abonné{follow.followers > 1 ? "s" : ""}
          </span>
          <span>
            <b>{follow.following}</b> abonnement{follow.following > 1 ? "s" : ""}
          </span>
        </div>
        <div className="profile-wallet">
          <Wallet /> {shortWallet(u.wallet)}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-box">
          <div className="sb-val accent">
            <ZapIcon />
            {fmtSol(u.received)}
          </div>
          <div className="sb-label">SOL reçus</div>
        </div>
        <div className="stat-box">
          <div className="sb-val accent">
            <ZapIcon />
            {fmtSol(u.zapped)}
          </div>
          <div className="sb-label">SOL zappés au créateur</div>
        </div>
        <div className="stat-box">
          <div className="sb-val">
            {showGiven ? (
              <>
                <ZapIcon />
                {fmtSol(u.given)}
              </>
            ) : (
              "—"
            )}
          </div>
          <div className="sb-label">SOL envoyés</div>
        </div>
        <div className="stat-box">
          <div className="sb-val">{data.postsCount}</div>
          <div className="sb-label">posts en vie</div>
        </div>
      </div>
      {!showGiven && (
        <p className="faint hint-line">
          <EyeOff /> Historique de zaps masqué.
        </p>
      )}

      <div className="section-title">Posts en vie</div>
      {data.active.length ? (
        data.active.map((p) => <PostCard key={p.id} post={p} />)
      ) : (
        <ZaprEmpty title="Aucun post en vie.">
          <span>{isMe ? "Poste un truc, le feed t'attend." : "Rien pour l'instant."}</span>
        </ZaprEmpty>
      )}
    </section>
  );
}
