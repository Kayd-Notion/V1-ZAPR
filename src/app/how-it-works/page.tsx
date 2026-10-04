import type { Metadata } from "next";
import Link from "next/link";
import { IconCrown, IconHourglass, IconUserPlus, IconWallet, IconZap } from "@/components/icons";
import { BoostGauge } from "@/components/BoostGauge";
import { ZaprMark } from "@/components/ZaprMark";
import { HowItWorksCta } from "@/components/HowItWorksCta";
import { LIFESPAN_CONFIG } from "@/lib/lifespan-config";
import { HOURS_PER_SOL, PURGE_GRACE_MS } from "@/lib/lifespan";
import { CREATOR_ZAP_SPLIT, MIN_CREATOR_ZAP_SOL, MIN_PUMP_SOL, resolvedSplitBps } from "@/lib/pump-config";
import { CLUSTER, IS_MAINNET } from "@/lib/solana";

export const metadata: Metadata = {
  title: "How it works",
  description: "Post, get zapped in SOL, stay alive: ZAPR explained in one page.",
};

const pct = (bps: number) => `${bps / 100}%`;

/** "x.10", "x.25"… or "next whole SOL" for the last milestone of each SOL. */
function stepLabel(at: number): string {
  return at >= 1 ? "The next whole SOL" : `x${at.toFixed(2).slice(1)} SOL`;
}

export default function HowItWorksPage() {
  const post = resolvedSplitBps();
  const creator = CREATOR_ZAP_SPLIT;
  const base = LIFESPAN_CONFIG.baseHours;
  let cumul = 0;

  return (
    <section className="hiw">
      <div className="subbar">
        <div className="page-title">How it works</div>
      </div>

      <div className="hiw-hero">
        <ZaprMark className="hiw-mark" />
        <h1>Post. Get zapped. Stay alive.</h1>
        <p>
          ZAPR is a social network on Solana where attention is paid in SOL. Every post starts with{" "}
          <b>{base} hours</b> to live. Each <b>zap</b> (SOL sent to a post) pays its creator and buys the post more
          time. No zaps, no life.
        </p>
        {!IS_MAINNET && (
          <p className="hiw-net">
            ZAPR runs on Solana <b>{CLUSTER}</b>: test SOL only, no real money.
          </p>
        )}
      </div>

      <h2 className="hiw-h2">Three steps</h2>
      <ol className="hiw-steps">
        <li>
          <span className="hiw-num">1</span>
          <div>
            <b>Connect your wallet</b>
            Phantom, Solflare or Backpack. You sign a message to prove the wallet is yours: it&apos;s free, nothing is
            sent. Then pick a username.
          </div>
        </li>
        <li>
          <span className="hiw-num">2</span>
          <div>
            <b>Post</b>
            Text, photo or video. Your post goes live for {base} hours.
          </div>
        </li>
        <li>
          <span className="hiw-num">3</span>
          <div>
            <b>Zap</b>
            Like a post? Send it SOL, from {MIN_PUMP_SOL} SOL. The creator gets paid, the post gets more time and
            climbs the leaderboard.
          </div>
        </li>
      </ol>

      <h2 className="hiw-h2">
        <IconWallet /> Where your SOL goes
      </h2>
      <div className="hiw-splits">
        <div className="hiw-split">
          <b>Zap a post</b>
          <div className="split-bar">
            <div className="s-creator" style={{ width: pct(post.creatorBps) }} />
            <div className="s-pool" style={{ width: pct(post.founderBps) }} />
          </div>
          <div className="hiw-split-legend">
            <span className="accent">{pct(post.creatorBps)} to the creator</span>
            <span>{pct(post.founderBps)} to ZAPR</span>
          </div>
        </div>
        <div className="hiw-split">
          <b>Zap a creator</b>
          <div className="split-bar">
            <div className="s-creator" style={{ width: pct(creator.creatorBps) }} />
            <div className="s-pool" style={{ width: pct(creator.founderBps) }} />
          </div>
          <div className="hiw-split-legend">
            <span className="accent">{pct(creator.creatorBps)} to the creator</span>
            <span>{pct(creator.founderBps)} to ZAPR</span>
          </div>
        </div>
      </div>
      <p className="hiw-p">
        Both parts travel in <b>one single transaction</b>: they both go through, or nothing moves. ZAPR never holds
        your SOL: it goes straight from your wallet to the creator&apos;s.
      </p>

      <h2 className="hiw-h2">
        <IconHourglass /> Zaps keep posts alive
      </h2>
      <p className="hiw-p">
        A post is born with <b>{base} h</b>. Each zap adds to the post&apos;s total; every time the total crosses a
        milestone, the post gains time, <b>added to the time it has left</b>. The milestones repeat inside every SOL
        (0 to 1, 1 to 2, 2 to 3…):
      </p>
      <table className="hiw-table">
        <thead>
          <tr>
            <th>The post&apos;s total reaches</th>
            <th>Time gained</th>
            <th>Total in that SOL</th>
          </tr>
        </thead>
        <tbody>
          {LIFESPAN_CONFIG.stepsPerSol.map((s) => {
            cumul += s.hours;
            return (
              <tr key={s.at}>
                <td>{stepLabel(s.at)}</td>
                <td className="accent">+{s.hours}h</td>
                <td>{cumul}h</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hiw-p">
        So <b>1 full SOL = +{HOURS_PER_SOL}h</b>, always. There is no cap: a post that keeps getting zapped lives
        forever. Only the total counts: ten zaps of 0.1 SOL do the same as one zap of 1 SOL.
      </p>
      <div className="hiw-example">
        <div className="hiw-example-cap">Example: a post at 0.2 SOL receives a 0.3 SOL zap.</div>
        <BoostGauge total={0.2} adding={0.3} />
      </div>
      <p className="hiw-p">
        When the clock hits zero, the post disappears from everywhere and can&apos;t be zapped anymore. It is deleted{" "}
        {PURGE_GRACE_MS / 60_000} minutes later.
      </p>

      <h2 className="hiw-h2">
        <IconUserPlus /> Follow and zap creators
      </h2>
      <p className="hiw-p">
        <b>Follow</b> anyone for free: their posts land in your <b>Following</b> tab. From a profile you can also{" "}
        <b>zap the creator</b> directly (from {MIN_CREATOR_ZAP_SOL} SOL): {pct(creator.creatorBps)} goes to them. It
        doesn&apos;t change their posts&apos; lifetime, but it counts in the Creators leaderboard.
      </p>

      <h2 className="hiw-h2">
        <IconCrown /> Leaderboards
      </h2>
      <p className="hiw-p">
        <b>Posts</b>: the most zapped live posts. <b>Creators</b>: the creators who received the most SOL (their share
        of zaps on their posts, plus direct zaps). Filter by period (all time, 24h, 7 days, 30 days), worldwide or by
        country.
      </p>

      <h2 className="hiw-h2">
        <IconZap /> FAQ
      </h2>
      <div className="hiw-faq">
        <details>
          <summary>Is this real money?</summary>
          <p>
            {IS_MAINNET
              ? "Zaps are disabled on mainnet until ZAPR's on-chain program is audited."
              : `No. ZAPR runs on Solana ${CLUSTER}, a test network: its SOL is free and worth nothing. Zaps are blocked on the real network (mainnet) until ZAPR's on-chain program is audited.`}
          </p>
        </details>
        <details>
          <summary>Where do I get test SOL?</summary>
          <p>
            On the <Link href="/wallet">Wallet</Link> page, tap &ldquo;Devnet faucet&rdquo;. If it&apos;s dry, use{" "}
            <a href="https://faucet.solana.com" target="_blank" rel="noreferrer">
              faucet.solana.com
            </a>{" "}
            with your wallet address. You don&apos;t need to switch your wallet to devnet: ZAPR sends the transaction
            on {CLUSTER} itself.
          </p>
        </details>
        <details>
          <summary>What does a zap cost?</summary>
          <p>
            The amount you choose, plus a Solana network fee (a tiny fraction of a cent). Posting a photo or a video
            also pays for its permanent storage (Arweave), from your wallet.
          </p>
        </details>
        <details>
          <summary>Can I zap my own post?</summary>
          <p>
            Yes. It shows with a &ldquo;self-zap&rdquo; badge and counts like any other zap. You get the creator share
            back, so you really pay the platform share plus fees.
          </p>
        </details>
        <details>
          <summary>Can I zap anonymously?</summary>
          <p>
            Yes: turn on anonymous zaps in <Link href="/settings">Settings</Link>. Other people then see
            &ldquo;Anonymous zapper&rdquo; instead of your username. The transaction itself stays public on the
            blockchain, like every Solana transaction.
          </p>
        </details>
        <details>
          <summary>Can I delete a post?</summary>
          <p>
            Yes, from its &ldquo;⋯&rdquo; menu, as long as nobody has zapped it. Once SOL moved for a post, it stays
            until its time runs out: the people who paid keep what they paid for. You can always delete your comments,
            and the comments under your posts.
          </p>
        </details>
        <details>
          <summary>Can a zap be refunded?</summary>
          <p>
            No. A blockchain transaction is final. Check the amount before you sign: the zap window shows exactly what
            the creator and the platform get.
          </p>
        </details>
      </div>

      <HowItWorksCta />

      <p className="hiw-legal">
        Read the <Link href="/terms">Terms</Link>, the <Link href="/privacy">Privacy policy</Link> and the{" "}
        <Link href="/risks">Risks</Link>.
      </p>
    </section>
  );
}
