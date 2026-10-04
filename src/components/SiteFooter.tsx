import Link from "next/link";
import { CLUSTER } from "@/lib/solana";

/** Small links under every page: the guide and the legal pages. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav aria-label="About ZAPR">
        <Link href="/how-it-works">How it works</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/risks">Risks</Link>
      </nav>
      <span>ZAPR prototype · Solana {CLUSTER}</span>
    </footer>
  );
}
