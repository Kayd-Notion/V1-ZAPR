"use client";
import Link from "next/link";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";

/** Bottom of "How it works": connect for visitors, back to the feed otherwise. */
export function HowItWorksCta() {
  const { user } = useSession();
  const { openConnect } = useUI();

  return (
    <div className="hiw-cta">
      <b>{user ? "You're in. Go zap something." : "Ready to light the bolt?"}</b>
      <div className="hiw-cta-actions">
        {!user && (
          <button className="btn btn-primary" onClick={() => openConnect("Connect your Solana wallet to enter the arena.")}>
            Connect
          </button>
        )}
        <Link href="/" className={`btn${user ? " btn-primary" : ""}`}>
          {user ? "Go to the feed" : "Look around first"}
        </Link>
      </div>
    </div>
  );
}
