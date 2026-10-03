"use client";
import { useEffect, useState } from "react";
import { IconAlert, IconHourglass, IconPlatform, IconTrash, IconUser, IconZap } from "@/components/icons";
import { Modal } from "../Modal";
import { Avatar } from "../Avatar";
import { ZaprMark } from "../ZaprMark";
import { useUI } from "@/context/UIContext";
import { useSession } from "@/context/SessionContext";
import { usePump } from "@/hooks/usePump";
import { quotePump } from "@/lib/pump";
import { MIN_PUMP_SOL, QUICK_ZAP_AMOUNTS, resolvedSplitBps } from "@/lib/pump-config";
import { formatSol } from "@/lib/pump-rules";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import type { PumpQuote } from "@/lib/api-types";
import { IS_MAINNET } from "@/lib/solana";

const EPS = 1e-9;

/** Reads the new minimum from a refusal body. */
function minFromError(data: Record<string, unknown>): number | null {
  const n = Number(data.requiredMinSol);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function PumpModal() {
  const { pumpTarget, closeModal, toast, bumpData } = useUI();
  const { user } = useSession();
  const { runPump, canSign } = usePump();
  const [amount, setAmount] = useState(0.1);
  const [phase, setPhase] = useState<"form" | "sending" | "success">("form");
  const [split, setSplit] = useState(() => resolvedSplitBps());
  const [minPump, setMinPump] = useState(MIN_PUMP_SOL);
  // Rules for this post right now (null while loading).
  const [quote, setQuote] = useState<PumpQuote | null>(null);

  // Ratio + minimum the data source will actually enforce.
  useEffect(() => {
    api
      .pumpConfig()
      .then((c) => {
        setSplit({ creatorBps: c.creatorBps, founderBps: c.platformBps });
        setMinPump(c.minPumpSol);
      })
      .catch(() => {});
  }, []);

  // Rule 2: is the post still pumpable, and how much does it take?
  const postId = pumpTarget?.id;
  useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    setQuote(null);
    api
      .pumpQuote(postId)
      .then((q) => {
        if (cancelled) return;
        setQuote(q);
        // Expired post: pre-select the amount that saves it.
        if (q.status === "expired") setAmount(q.requiredMinSol);
      })
      .catch((e) => {
        if (cancelled) return;
        // Post gone (404/409): treat as deleted; otherwise fall back to the
        // global minimum and let the server-side pre-check decide.
        const gone = e instanceof ApiError && (e.status === 404 || e.code === "post_deleted");
        setQuote({
          status: gone ? "deleted" : "active",
          minPumpSol: MIN_PUMP_SOL,
          minToSaveSol: null,
          requiredMinSol: MIN_PUMP_SOL,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  if (!pumpTarget) return null;
  const post = pumpTarget;
  const { creatorBps, founderBps } = split;
  const safeAmount = amount > 0 ? amount : 0;
  const q = quote;
  const expired = q?.status === "expired";
  const requiredMin = Math.max(minPump, q?.requiredMinSol ?? minPump);
  const tooLow = safeAmount + EPS < requiredMin;
  const quoteSplit = quotePump(safeAmount, founderBps);

  // Validation message under the amount (UI side of rules 2 + 3).
  let amountError: string | null = null;
  if (q && tooLow) {
    amountError = expired
      ? `This post has expired. It takes at least ${formatSol(requiredMin)} SOL to save it.`
      : `Minimum ${formatSol(minPump)} SOL`;
  }

  const confirm = async () => {
    if (!q || tooLow) return;
    if (!canSign) {
      toast("Reconnect your wallet to sign the transaction.");
      return;
    }
    setPhase("sending");
    try {
      await runPump(post, safeAmount, user?.anonymizePumps ?? false);
      setPhase("success");
      bumpData();
      setTimeout(() => {
        closeModal();
        toast(`${formatSol(safeAmount)} SOL zapped. LFG.`);
      }, 1200);
    } catch (e) {
      setPhase("form");
      // Server refused right before signing (nothing was signed).
      if (e instanceof ApiError && e.code === "post_deleted") {
        setQuote({ ...q, status: "deleted" });
        return;
      }
      if (e instanceof ApiError && e.code === "amount_too_low_to_save") {
        const min = minFromError(e.data);
        if (min) {
          setQuote({ ...q, status: "expired", minToSaveSol: min, requiredMinSol: min });
          setAmount(min);
        }
      }
      toast(e instanceof Error ? e.message : "The zap failed.");
    }
  };

  // --- Post purged: no pump possible ------------------------------------
  if (q?.status === "deleted") {
    return (
      <Modal title="Zap this post" icon={<IconZap />} onClose={closeModal}>
        <div className="zempty">
          <IconTrash className="zempty-ico" />
          <b>Too late, it&apos;s gone.</b>
          <span>This post expired and was deleted: it can&apos;t get zaps anymore. No SOL was sent.</span>
        </div>
        <button className="btn btn-block" onClick={closeModal}>
          Close
        </button>
      </Modal>
    );
  }

  return (
    <Modal title="Zap this post" icon={<IconZap />} onClose={closeModal}>
      {phase === "success" ? (
        <div className="pump-success">
          <ZaprMark className="ps-mark" />
          <h3>Zap sent. LFG.</h3>
          <p className="muted">
            <b>+{formatSol(safeAmount)} SOL</b> on this post.
            <br />
            It just got more time to live.
          </p>
        </div>
      ) : (
        <>
          <div className="pump-target">
            <Avatar id={post.author.id} handle={post.author.handle} size="sm" />
            <div className="pt-text">
              You&apos;re zapping <b>@{post.author.handle}</b>
              <br />&ldquo;{post.text.slice(0, 60)}
              {post.text.length > 60 ? "…" : ""}&rdquo;
            </div>
          </div>

          {IS_MAINNET && (
            <p className="warn-line">
              <IconAlert /> Zaps are disabled on mainnet (program not audited yet).
            </p>
          )}

          {expired && (
            <div className="pump-notice">
              <p>
                <b className="notice-title">
                  <IconHourglass /> This post is RIP.
                </b>{" "}
                It takes at least <b>{formatSol(requiredMin)} SOL</b> to bring it back (otherwise it gets deleted).
              </p>
              {tooLow && (
                <button className="btn btn-sm btn-accent-soft" style={{ marginTop: 8 }} onClick={() => setAmount(requiredMin)}>
                  Use {formatSol(requiredMin)} SOL
                </button>
              )}
            </div>
          )}

          <label className="field-label">How much are you sending?</label>
          <div className="quick-amounts">
            {QUICK_ZAP_AMOUNTS.map((a) => (
              <button
                key={a}
                className={`qa-btn${a === amount ? " active" : ""}`}
                onClick={() => setAmount(a)}
                // Only an expired post's save minimum disables quick amounts
                // (they all start at 0.01, above MIN_PUMP_SOL).
                disabled={expired && a + EPS < requiredMin}
                title={expired && a + EPS < requiredMin ? "Not enough to save this post" : undefined}
              >
                {a}
              </button>
            ))}
          </div>

          <label className="field-label">Custom amount (SOL)</label>
          <input
            className={`field${amountError ? " field-invalid" : ""}`}
            type="number"
            step="0.001"
            min={requiredMin}
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            aria-invalid={Boolean(amountError)}
          />
          {amountError && <p className="field-error">{amountError}</p>}

          <div className="split-box">
            <div className="split-row creator">
              <span>
                <IconUser /> Creator ({creatorBps / 100}%)
              </span>
              <b>{formatSol(quoteSplit.creatorSol)} SOL</b>
            </div>
            <div className="split-row">
              <span>
                <IconPlatform /> Platform ({founderBps / 100}%)
              </span>
              <b>{formatSol(quoteSplit.founderSol)} SOL</b>
            </div>
            <div className="split-bar">
              <div className="s-creator" style={{ width: `${creatorBps / 100}%` }} />
              <div className="s-pool" style={{ width: `${founderBps / 100}%` }} />
            </div>
            <div
              className="split-row"
              style={{ borderTop: "1px solid var(--border-soft)", marginTop: 6, paddingTop: 8 }}
            >
              <span>Total</span>
              <b>{formatSol(safeAmount)} SOL</b>
            </div>
          </div>

          <button
            className="btn btn-primary btn-block"
            onClick={confirm}
            disabled={!q || tooLow || phase === "sending" || IS_MAINNET}
          >
            {!q ? (
              <>
                <span className="spinner" /> Checking the post…
              </>
            ) : phase === "sending" ? (
              <>
                <span className="spinner" /> Sign in your wallet…
              </>
            ) : (
              <>
                <IconZap /> Send it · {formatSol(safeAmount)} SOL
              </>
            )}
          </button>
          <button
            className="btn btn-ghost btn-block"
            style={{ marginTop: 8 }}
            onClick={closeModal}
            disabled={phase === "sending"}
          >
            Nah, forget it
          </button>
        </>
      )}
    </Modal>
  );
}
