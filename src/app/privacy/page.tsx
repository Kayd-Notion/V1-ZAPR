import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="October 6, 2026">
      <h2>In short</h2>
      <ul>
        <li>No email, no password, no real name: your account is your wallet.</li>
        <li>
          Your <b>IP address is never stored</b>. Only a country code (like &ldquo;FR&rdquo;) is kept, for the
          leaderboards by country.
        </li>
        <li>No ads, no trackers, no analytics.</li>
        <li>Transactions on the blockchain and media on Arweave are public and permanent.</li>
      </ul>

      <h2>What ZAPR stores</h2>
      <ul>
        <li>
          <b>Account</b>: your wallet&apos;s public address, username, bio, profile picture link, country code,
          sign-up date and privacy settings. If you link more wallets (Google, another wallet), their addresses
          too: they are never shown to other people on ZAPR.
        </li>
        <li>
          <b>Activity</b>: your posts, comments, follows, reports (seen only by the ZAPR team), and the record of every zap (amount, split, date,
          transaction signature, anonymous or not).
        </li>
        <li>
          <b>Country</b>: worked out at each visit from a header added by our host (Vercel). Only the 2-letter code is
          kept, on your account and your posts.
        </li>
      </ul>

      <h2>What stays in your browser</h2>
      <ul>
        <li>
          <code>zapr_session</code>: keeps you signed in for 30 days. It is signed and can&apos;t be read by scripts.
        </li>
        <li>
          <code>zapr_nonce</code>: a one-time code used while you sign in, gone after 5 minutes.
        </li>
        <li>A few local settings: whether you are signed in, and whether you have seen the welcome message.</li>
      </ul>

      <h2>What is public by nature</h2>
      <ul>
        <li>
          <b>Solana transactions</b> (your zaps) are public forever: anyone can see the sending wallet, the receiving
          wallets and the amount. &ldquo;Anonymous zaps&rdquo; only hide your username on ZAPR.
        </li>
        <li>
          <b>Photos, videos and profile pictures</b> are stored on Arweave (through Irys): public and permanent,
          even if they are deleted or replaced on ZAPR.
        </li>
      </ul>

      <h2>Who processes the data</h2>
      <ul>
        <li>Vercel (hosting), Neon (database).</li>
        <li>Irys / Arweave (media storage).</li>
        <li>
          Privy, only if you sign in with Google or Apple: it creates and secures your Solana wallet, and receives
          the email of your Google / Apple account. You can export that wallet&apos;s key from Settings.
        </li>
        <li>A Solana RPC provider (reads balances and sends transactions; it sees your wallet address).</li>
      </ul>

      <h2>How long</h2>
      <ul>
        <li>Expired posts and their comments are deleted about 10 minutes after they expire.</li>
        <li>
          Zap records are kept: they are the record of money that moved, and they feed the creators&apos; totals.
        </li>
        <li>Your account is kept until you ask for its deletion.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can change your username, bio, picture and privacy settings in Settings, and delete your comments and your
        posts that have no zap yet. To get
        a copy of your data or delete your account, contact the ZAPR team (contact address to be published before the
        public launch).
      </p>
    </LegalPage>
  );
}
