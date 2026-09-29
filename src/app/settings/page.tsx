"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LogOut } from "lucide-react";
import { ZaprEmpty } from "@/components/ZaprMark";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { api } from "@/lib/api";
import { shortWallet } from "@/lib/format";

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser, logout } = useSession();
  const { theme, toggleTheme, toast, openConnect } = useUI();
  const [bio, setBio] = useState("");
  const [handle, setHandle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setBio(user.bio);
      setHandle(user.handle);
    }
  }, [user]);

  if (!user) {
    return (
      <ZaprEmpty title="Connecte-toi pour régler ton compte.">
        <button
          className="btn btn-primary"
          onClick={() => openConnect("Connecte ton wallet pour accéder aux réglages.")}
        >
          Connecter
        </button>
      </ZaprEmpty>
    );
  }

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.updateMe({ bio, handle });
      setUser(res.user);
      toast("Profil à jour.");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const setPrivacy = async (patch: { hidePumpHistory?: boolean; anonymizePumps?: boolean }) => {
    try {
      const res = await api.updateMe(patch);
      setUser(res.user);
      toast("C'est noté.");
    } catch {
      toast("Mise à jour impossible.");
    }
  };

  return (
    <section>
      <div className="subbar">
        <button className="icon-btn" onClick={() => router.push("/profile")} aria-label="Retour">
          <ArrowLeft />
        </button>
        <div className="page-title">Réglages</div>
      </div>

      <div className="settings-group">
        <div className="sg-title">Profil</div>
        <div style={{ padding: "14px 16px" }}>
          <label className="field-label">Ton blase</label>
          <input className="field" value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={20} />
        </div>
        <div style={{ padding: "0 16px 14px" }}>
          <label className="field-label">Bio</label>
          <textarea
            className="field"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={240}
            style={{ resize: "none" }}
          />
        </div>
        <div style={{ padding: "0 16px 16px" }}>
          <button className="btn btn-primary btn-block" onClick={save} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>

      <div className="settings-group">
        <div className="sg-title">Confidentialité</div>
        <div className="settings-row">
          <div className="sr-text">
            Masquer mon historique de zaps
            <small>Cache le total « SOL envoyés » sur ton profil public</small>
          </div>
          <div
            className={`toggle${user.hidePumpHistory ? " on" : ""}`}
            onClick={() => setPrivacy({ hidePumpHistory: !user.hidePumpHistory })}
          >
            <span className="tg-switch" />
          </div>
        </div>
        <div className="settings-row">
          <div className="sr-text">
            Anonymiser mes zaps par défaut
            <small>Apparaître comme « Zappeur anonyme » dans les historiques</small>
          </div>
          <div
            className={`toggle${user.anonymizePumps ? " on" : ""}`}
            onClick={() => setPrivacy({ anonymizePumps: !user.anonymizePumps })}
          >
            <span className="tg-switch" />
          </div>
        </div>
      </div>

      <div className="settings-group">
        <div className="sg-title">Apparence</div>
        <div className="settings-row">
          <div className="sr-text">Mode sombre</div>
          <div className={`toggle${theme === "dark" ? " on" : ""}`} onClick={toggleTheme}>
            <span className="tg-switch" />
          </div>
        </div>
      </div>

      <div className="settings-group">
        <div className="sg-title">Compte</div>
        <div className="settings-row" style={{ cursor: "pointer" }} onClick={() => logout()}>
          <div className="sr-text">
            Déconnecter le wallet
            <small>{shortWallet(user.wallet)}</small>
          </div>
          <LogOut className="sr-ico" />
        </div>
      </div>
    </section>
  );
}
