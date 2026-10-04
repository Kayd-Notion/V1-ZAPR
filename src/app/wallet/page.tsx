"use client";
import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { IconDroplet, IconExternal, IconZap } from "@/components/icons";
import { ZaprEmpty } from "@/components/ZaprMark";
import { ActivityList } from "@/components/ActivityList";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { fmtSol, lamportsToSol } from "@/lib/format";
import { CLUSTER, explorerAddressUrl } from "@/lib/solana";

export default function WalletPage() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { user } = useSession();
  const { openConnect, toast, dataVersion } = useUI();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    connection
      .getBalance(publicKey)
      .then((lamports) => !cancelled && setBalance(lamportsToSol(lamports)))
      .catch(() => !cancelled && setBalance(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [publicKey, connection, dataVersion]);

  if (!user) {
    return (
      <section>
        <ZaprEmpty title="No wallet, no zaps.">
          <button
            className="btn btn-primary"
            onClick={() => openConnect("Connect your wallet to see your balance.")}
          >
            Connect
          </button>
        </ZaprEmpty>
      </section>
    );
  }

  return (
    <section>
      <div className="subbar">
        <div className="page-title">Wallet</div>
      </div>
      <div className="balance-card">
        <IconZap className="bc-mark" />
        <div className="bc-label">Your balance ({CLUSTER})</div>
        <div className="bc-value">
          {loading || balance === null ? "…" : `${fmtSol(balance)} SOL`}
        </div>
        <div className="bc-actions">
          <button
            className="btn"
            onClick={() =>
              publicKey &&
              connection
                .requestAirdrop(publicKey, 1_000_000_000)
                .then(() => toast("1 devnet SOL on the way."))
                .catch(() => toast("Faucet is dry (RPC limit). Try again later or use faucet.solana.com."))
            }
          >
            <IconDroplet /> Devnet faucet +1 SOL
          </button>
        </div>
      </div>

      <div className="section-title">Your stats</div>
      <div className="stats-grid">
        <div className="stat-box">
          <div className="sb-val accent">
            <IconZap />
            {fmtSol(user.received)}
          </div>
          <div className="sb-label">SOL received</div>
        </div>
        <div className="stat-box">
          <div className="sb-val accent">
            <IconZap />
            {fmtSol(user.zapped)}
          </div>
          <div className="sb-label">SOL zapped to you</div>
        </div>
        <div className="stat-box">
          <div className="sb-val">
            <IconZap />
            {fmtSol(user.given)}
          </div>
          <div className="sb-label">SOL sent</div>
        </div>
        <div className="stat-box">
          <div className="sb-val">{publicKey ? "Yes" : "No"}</div>
          <div className="sb-label">Wallet linked</div>
        </div>
      </div>

      <p className="faint hint-line">
        Balance read live from the blockchain ({CLUSTER}).
        {publicKey && (
          <>
            {" "}
            <a href={explorerAddressUrl(publicKey.toBase58())} target="_blank" rel="noreferrer">
              View on explorer <IconExternal />
            </a>
          </>
        )}
      </p>

      <div className="section-title">Activity</div>
      <ActivityList />
    </section>
  );
}
