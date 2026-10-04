"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconCrown, IconHourglass, IconZap } from "@/components/icons";
import { useSession } from "@/context/SessionContext";
import { useUI } from "@/context/UIContext";
import { LIFESPAN_CONFIG } from "@/lib/lifespan-config";
import { resolvedSplitBps } from "@/lib/pump-config";
import { CLUSTER, IS_MAINNET } from "@/lib/solana";
import { Modal } from "../Modal";

const SEEN_KEY = "zapr_welcomed";
// Pages that already explain ZAPR (or are legal text): no welcome over them.
const QUIET = ["/how-it-works", "/terms", "/privacy", "/risks"];

/**
 * First visit only, for visitors without a session: ZAPR in three lines and a
 * link to "How it works". Never shown again once closed.
 */
export function WelcomeModal() {
  const { status } = useSession();
  const { activeModal } = useUI();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status !== "anonymous" || activeModal !== null) return;
    if (QUIET.some((p) => pathname.startsWith(p))) return;
    try {
      if (localStorage.getItem(SEEN_KEY) === "1") return;
    } catch {
      return; // no storage: don't risk showing it on every visit
    }
    setOpen(true);
  }, [status, activeModal, pathname]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  // Another modal opened (e.g. Connect): step aside, it is marked as seen.
  useEffect(() => {
    if (open && activeModal !== null) close();
  }, [activeModal]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;
  const { creatorBps } = resolvedSplitBps();

  return (
    <Modal title="Welcome to ZAPR" icon={<IconZap />} onClose={close}>
      <ul className="welcome-list">
        <li>
          <IconZap />
          <span>
            <b>Zap posts with SOL.</b> {creatorBps / 100}% goes straight to the creator.
          </span>
        </li>
        <li>
          <IconHourglass />
          <span>
            <b>Every post lives {LIFESPAN_CONFIG.baseHours}h.</b> Zaps buy it more time, with no limit.
          </span>
        </li>
        <li>
          <IconCrown />
          <span>
            <b>The most zapped climb the Top.</b> Posts and creators, worldwide or by country.
          </span>
        </li>
      </ul>
      {!IS_MAINNET && <p className="welcome-net">Running on Solana {CLUSTER}: test SOL only, no real money.</p>}
      <Link href="/how-it-works" className="btn btn-primary btn-block" onClick={close}>
        How it works
      </Link>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 8 }} onClick={close}>
        Let me look around
      </button>
    </Modal>
  );
}
