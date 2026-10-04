import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { CREATOR_ZAP_SPLIT, resolvedSplitBps } from "@/lib/pump-config";
import { CLUSTER } from "@/lib/solana";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  const post = resolvedSplitBps();
  return (
    <LegalPage title="Terms of use" updated="October 4, 2026">
      <h2>1. What ZAPR is</h2>
      <p>
        ZAPR is a social network where people publish posts and send each other SOL (&ldquo;zaps&rdquo;) on the Solana
        blockchain. ZAPR is a <b>prototype</b>: it runs on Solana <b>{CLUSTER}</b>, a test network whose SOL has no
        value. Features, rules and data may change or be reset at any time.
      </p>

      <h2>2. Who can use it</h2>
      <p>
        You must be at least 18 years old and allowed to use crypto services where you live. You sign in with your own
        Solana wallet; you are responsible for keeping it safe. ZAPR never asks for your recovery phrase.
      </p>

      <h2>3. Your content</h2>
      <p>
        You keep the rights to what you post and give ZAPR the right to display it on the service. You are responsible
        for your content. It is forbidden to post:
      </p>
      <ul>
        <li>anything illegal, or content you don&apos;t have the rights to;</li>
        <li>harassment, threats, hate speech or incitement to violence;</li>
        <li>sexual content involving minors (reported to the authorities), or non-consensual intimate content;</li>
        <li>scams, phishing, fake giveaways, impersonation of a person or a project;</li>
        <li>spam, malware, or attempts to manipulate zaps and leaderboards.</li>
      </ul>
      <p>
        Photos and videos are stored on <b>Arweave</b>, a permanent public storage network: they cannot be deleted from
        it, even if the post is deleted on ZAPR.
      </p>

      <h2>4. Moderation</h2>
      <p>
        ZAPR may hide content or ban an account that breaks these terms, without notice. A ban blocks posting and zapping on ZAPR; it cannot cancel transactions already made on the blockchain.
      </p>

      <h2>5. Zaps</h2>
      <ul>
        <li>
          A zap on a post sends {post.creatorBps / 100}% to its creator and {post.founderBps / 100}% to ZAPR; a zap
          to a creator sends {CREATOR_ZAP_SPLIT.creatorBps / 100}% to the creator and{" "}
          {CREATOR_ZAP_SPLIT.founderBps / 100}% to ZAPR, in a single transaction signed by you.
        </li>
        <li>
          ZAPR is <b>non-custodial</b>: it never holds your SOL. A transaction is final and cannot be refunded.
        </li>
        <li>
          A zap is a tip. It buys no share, token, right or return of any kind, and is not an investment. Nothing on
          ZAPR is financial advice.
        </li>
        <li>
          Post lifetime rules (see <Link href="/how-it-works">How it works</Link>) may change during the prototype.
        </li>
      </ul>

      <h2>6. No warranty</h2>
      <p>
        ZAPR is provided &ldquo;as is&rdquo;, without warranty. It may have bugs, outages or data loss. To the extent
        allowed by law, ZAPR is not liable for indirect losses, lost SOL caused by your wallet, the blockchain or third
        parties, or content posted by users.
      </p>

      <h2>7. Changes</h2>
      <p>
        These terms may change. The date at the top shows the latest version; using ZAPR after a change means you
        accept it.
      </p>
    </LegalPage>
  );
}
