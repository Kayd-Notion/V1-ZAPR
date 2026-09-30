"use client";
import { useState } from "react";
import { Landmark, User } from "lucide-react";
import { Modal } from "../Modal";
import { Avatar } from "../Avatar";
import { ZapIcon, ZaprMark } from "../ZaprMark";
import { useUI } from "@/context/UIContext";
import { useSession } from "@/context/SessionContext";
import { useCreatorZap } from "@/hooks/useCreatorZap";
import { quotePump } from "@/lib/pump";
import { CREATOR_ZAP_SPLIT, MIN_CREATOR_ZAP_SOL } from "@/lib/pump-config";
import { formatSolFr } from "@/lib/pump-rules";
import { fmtSol } from "@/lib/format";
import { IS_MAINNET } from "@/lib/solana";

const QUICK_AMOUNTS = [0.05, 0.1, 0.5, 1];
const EPS = 1e-9;

/** Zap a creator directly (not a post): 90/10 by default, no effect on posts. */
export function CreatorZapModal() {
  const { creatorZapTarget: creator, closeModal, toast, bumpData } = useUI();
  const { user } = useSession();
  const { runCreatorZap, canSign } = useCreatorZap();
  const [amount, setAmount] = useState(0.1);
  const [phase, setPhase] = useState<"form" | "sending" | "success">("form");

  if (!creator) return null;
  const safeAmount = amount > 0 ? amount : 0;
  const { creatorBps, founderBps } = CREATOR_ZAP_SPLIT;
  const split = quotePump(safeAmount, founderBps);
  const tooLow = safeAmount + EPS < MIN_CREATOR_ZAP_SOL;

  const confirm = async () => {
    if (tooLow) return;
    if (!canSign) {
      toast("Reconnecte ton wallet pour signer la transaction.");
      return;
    }
    setPhase("sending");
    try {
      await runCreatorZap(creator, safeAmount, user?.anonymizePumps ?? false);
      setPhase("success");
      bumpData();
      setTimeout(() => {
        closeModal();
        toast(`Zap de ${fmtSol(safeAmount)} SOL envoyé à @${creator.handle}. LFG.`);
      }, 1200);
    } catch (e) {
      setPhase("form");
      toast(e instanceof Error ? e.message : "Le zap a échoué.");
    }
  };

  return (
    <Modal title="Zap ce créateur" icon={<ZapIcon />} onClose={closeModal}>
      {phase === "success" ? (
        <div className="pump-success">
          <ZaprMark className="ps-mark" />
          <h3>Zap envoyé. LFG.</h3>
          <p className="muted">
            <b>+{fmtSol(safeAmount)} SOL</b> pour @{creator.handle}.
            <br />
            Il grimpe dans le classement des créateurs zappés.
          </p>
        </div>
      ) : (
        <>
          <div className="pump-target">
            <Avatar id={creator.id} handle={creator.handle} size="sm" />
            <div className="pt-text">
              Tu envoies un zap direct à <b>@{creator.handle}</b>
              <br />
              Ça le fait monter dans le Top « Zappés », sans toucher à ses posts.
            </div>
          </div>

          {IS_MAINNET && (
            <p className="warn-line">Les zaps sont désactivés sur mainnet (programme non audité).</p>
          )}

          <label className="field-label">Combien tu envoies ?</label>
          <div className="quick-amounts">
            {QUICK_AMOUNTS.map((a) => (
              <button key={a} className={`qa-btn${a === amount ? " active" : ""}`} onClick={() => setAmount(a)}>
                {a}
              </button>
            ))}
          </div>

          <label className="field-label">Montant perso (SOL)</label>
          <input
            className={`field${tooLow ? " field-invalid" : ""}`}
            type="number"
            step="0.01"
            min={MIN_CREATOR_ZAP_SOL}
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            aria-invalid={tooLow}
          />
          {tooLow && <p className="field-error">Minimum {formatSolFr(MIN_CREATOR_ZAP_SOL)} SOL</p>}

          <div className="split-box">
            <div className="split-row creator">
              <span>
                <User /> Créateur ({creatorBps / 100}%)
              </span>
              <b>{fmtSol(split.creatorSol)} SOL</b>
            </div>
            <div className="split-row">
              <span>
                <Landmark /> Plateforme ({founderBps / 100}%)
              </span>
              <b>{fmtSol(split.founderSol)} SOL</b>
            </div>
            <div className="split-bar">
              <div className="s-creator" style={{ width: `${creatorBps / 100}%` }} />
              <div className="s-pool" style={{ width: `${founderBps / 100}%` }} />
            </div>
            <div className="split-row" style={{ borderTop: "1px solid var(--border-soft)", marginTop: 6, paddingTop: 8 }}>
              <span>Total</span>
              <b>{fmtSol(safeAmount)} SOL</b>
            </div>
          </div>

          <button
            className="btn btn-primary btn-block"
            onClick={confirm}
            disabled={tooLow || phase === "sending" || IS_MAINNET}
          >
            {phase === "sending" ? (
              <>
                <span className="spinner" /> Signe dans ton wallet…
              </>
            ) : (
              <>
                <ZapIcon /> Send it · {formatSolFr(safeAmount)} SOL
              </>
            )}
          </button>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={closeModal} disabled={phase === "sending"}>
            Laisse tomber
          </button>
        </>
      )}
    </Modal>
  );
}
