"use client";
import { useState } from "react";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { initials } from "@/lib/format";

/** First-connection pseudo picker (guide §Phase 1: création de pseudo). */
export function OnboardModal() {
  const { completeOnboarding } = useSession();
  const { toast } = useUI();
  const [pseudo, setPseudo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const v = pseudo.trim();
    if (v.length < 3) {
      toast("Choisis un pseudo (3 caractères min).");
      return;
    }
    setBusy(true);
    try {
      await completeOnboarding(v);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Impossible de créer le pseudo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboard">
      <div className="ob-inner">
        <div className="ob-logo">P</div>
        <h2>Bienvenue sur pump.social</h2>
        <p>Ton wallet est connecté. Choisis un pseudo pour commencer à pumper.</p>
        <div
          className="avatar lg ob-avatar-preview"
          style={{ background: "var(--accent)", color: "#04120c" }}
        >
          {pseudo.trim() ? initials(pseudo) : "?"}
        </div>
        <div style={{ textAlign: "left", marginBottom: 16 }}>
          <label className="field-label">Pseudo</label>
          <input
            className="field"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="ex: satoshi_fan"
            maxLength={20}
            autoFocus
          />
        </div>
        <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
          {busy ? "Création…" : "Entrer dans l'app"}
        </button>
      </div>
    </div>
  );
}
