"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, EyeOff, Wallet } from "lucide-react";
import { PostCard } from "./PostCard";
import { Avatar } from "./Avatar";
import { ZapIcon, ZaprEmpty, ZaprLoader } from "./ZaprMark";
import { api } from "@/lib/api";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { fmtSol, shortWallet } from "@/lib/format";
import type { ClientPost, ClientUser } from "@/lib/client-types";

export function ProfileView({ handle }: { handle: string }) {
  const router = useRouter();
  const { user } = useSession();
  const { dataVersion } = useUI();
  const [data, setData] = useState<{
    user: ClientUser;
    postsCount: number;
    active: ClientPost[];
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
          {isMe && (
            <button className="btn" style={{ marginTop: 12 }} onClick={() => router.push("/settings")}>
              Modifier le profil
            </button>
          )}
        </div>
        <div className="profile-name">{u.handle}</div>
        <div className="profile-handle">@{u.handle}</div>
        <div className="profile-bio">{u.bio}</div>
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
