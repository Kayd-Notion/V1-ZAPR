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
      toast("Pick a username (3 characters min).");
      return;
    }
    setBusy(true);
    try {
      await completeOnboarding(v);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't create the username.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="onboard">
      <div className="ob-inner">
        <ZaprMark className="ob-logo" />
        <h2>Welcome to the arena</h2>
        <p>Wallet connected. Pick your degen name and let&apos;s go.</p>
        <div
          className="avatar lg ob-avatar-preview"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          {pseudo.trim() ? initials(pseudo) : "?"}
        </div>
        <div style={{ textAlign: "left", marginBottom: 16 }}>
          <label className="field-label">Your username</label>
          <input
            className="field"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. satoshi_fan"
            maxLength={20}
            autoFocus
          />
        </div>
        <button className="btn btn-primary btn-block" onClick={submit} disabled={busy}>
          {busy ? "Creating…" : "Enter the arena"}
        </button>
      </div>
    </div>
  );
}
