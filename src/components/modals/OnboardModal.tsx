"use client";
import { useState } from "react";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { initials } from "@/lib/format";
import { ZaprMark } from "../ZaprMark";

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
        <ZaprMark className="ob-logo" />
        <h2>Bienvenue dans l&apos;arène</h2>
        <p>Wallet connecté. Choisis ton blase de degen, c&apos;est parti.</p>
        <div
          className="avatar lg ob-avatar-preview"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          {pseudo.trim() ? initials(pseudo) : "?"}
        </div>
        <div style={{ textAlign: "left", marginBottom: 16 }}>
          <label className="field-label">Ton blase</label>
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
          {busy ? "Création…" : "Entrer dans l'arène"}
        </button>
      </div>
    </div>
  );
}
