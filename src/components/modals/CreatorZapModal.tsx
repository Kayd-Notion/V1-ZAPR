"use client";
import { useState } from "react";
import { IconPlatform, IconUser, IconZap } from "@/components/icons";
import { Modal } from "../Modal";
import { Avatar } from "../Avatar";
import { ZaprMark } from "../ZaprMark";
import { useUI } from "@/context/UIContext";
import { useSession } from "@/context/SessionContext";
import { useCreatorZap } from "@/hooks/useCreatorZap";
import { quotePump } from "@/lib/pump";
import { CREATOR_ZAP_SPLIT, MIN_CREATOR_ZAP_SOL } from "@/lib/pump-config";
import { formatSol } from "@/lib/pump-rules";
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
      toast("Reconnect your wallet to sign the transaction.");
      return;
    }
    setPhase("sending");
    try {
      await runCreatorZap(creator, safeAmount, user?.anonymizePumps ?? false);
      setPhase("success");
      bumpData();
      setTimeout(() => {
        closeModal();
        toast(`${fmtSol(safeAmount)} SOL zapped to @${creator.handle}. LFG.`);
      }, 1200);
    } catch (e) {
      setPhase("form");
      toast(e instanceof Error ? e.message : "The zap failed.");
    }
  };

  return (
    <Modal title="Zap this creator" icon={<IconZap />} onClose={closeModal}>
      {phase === "success" ? (
        <div className="pump-success">
          <ZaprMark className="ps-mark" />
          <h3>Zap sent. LFG.</h3>
          <p className="muted">
            <b>+{fmtSol(safeAmount)} SOL</b> for @{creator.handle}.
            <br />
            They climb the Zapped creators leaderboard.
          </p>
        </div>
      ) : (
        <>
          <div className="pump-target">
            <Avatar id={creator.id} handle={creator.handle} size="sm" />
            <div className="pt-text">
              You&apos;re zapping <b>@{creator.handle}</b> directly
              <br />
              It pushes them up the &ldquo;Zapped&rdquo; Top, without touching their posts.
            </div>
          </div>

          {IS_MAINNET && (
            <p className="warn-line">Zaps are disabled on mainnet (program not audited yet).</p>
          )}

          <label className="field-label">How much are you sending?</label>
          <div className="quick-amounts">
            {QUICK_AMOUNTS.map((a) => (
              <button key={a} className={`qa-btn${a === amount ? " active" : ""}`} onClick={() => setAmount(a)}>
                {a}
              </button>
            ))}
          </div>

          <label className="field-label">Custom amount (SOL)</label>
          <input
            className={`field${tooLow ? " field-invalid" : ""}`}
            type="number"
            step="0.01"
            min={MIN_CREATOR_ZAP_SOL}
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            aria-invalid={tooLow}
          />
          {tooLow && <p className="field-error">Minimum {formatSol(MIN_CREATOR_ZAP_SOL)} SOL</p>}

          <div className="split-box">
            <div className="split-row creator">
              <span>
                <IconUser /> Creator ({creatorBps / 100}%)
              </span>
              <b>{fmtSol(split.creatorSol)} SOL</b>
            </div>
            <div className="split-row">
              <span>
                <IconPlatform /> Platform ({founderBps / 100}%)
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
                <span className="spinner" /> Sign in your wallet…
              </>
            ) : (
              <>
                <IconZap /> Send it · {formatSol(safeAmount)} SOL
              </>
            )}
          </button>
          <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={closeModal} disabled={phase === "sending"}>
            Nah, forget it
          </button>
        </>
      )}
    </Modal>
  );
}
