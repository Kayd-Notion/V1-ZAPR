import Link from "next/link";
import { CLUSTER } from "@/lib/solana";
import { FeedbackLink } from "./FeedbackLink";

/** Small links under every page: the guide, the legal pages and feedback. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav aria-label="About ZAPR">
        <Link href="/how-it-works">How it works</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/risks">Risks</Link>
        <FeedbackLink />
      </nav>
      <span>ZAPR prototype · Solana {CLUSTER}</span>
    </footer>
  );
}
