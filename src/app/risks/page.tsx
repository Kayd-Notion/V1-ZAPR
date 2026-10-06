import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { ContactEmail } from "@/components/ContactEmail";
import { CLUSTER, IS_MAINNET } from "@/lib/solana";

export const metadata: Metadata = { title: "Risks" };

export default function RisksPage() {
  return (
    <LegalPage title="Risks" updated="October 6, 2026">
      <h2>Test network</h2>
      <p>
        {IS_MAINNET
          ? "Zaps are disabled on mainnet: ZAPR's on-chain program has not been audited yet."
          : `ZAPR runs on Solana ${CLUSTER}. Its SOL is free and has no value. Zaps are blocked on the real network (mainnet) until ZAPR's on-chain program has been written and audited.`}
      </p>

      <h2>Your wallet, your responsibility</h2>
      <ul>
        <li>
          Never share your recovery phrase or private key. <b>ZAPR will never ask for it</b>, nor will anyone from the
          team.
        </li>
        <li>
          Read what your wallet asks you to sign. Signing in is a free message; a zap is a transaction with the amount
          shown in the zap window.
        </li>
        <li>If you lose access to your wallet, nobody, not even ZAPR, can recover it for you.</li>
      </ul>

      <h2>Transactions are final</h2>
      <p>
        A zap can&apos;t be cancelled or refunded once it is sent. Check the amount before signing. A zap is a tip: it
        is not an investment and brings no return.
      </p>

      <h2>Everything on-chain is public</h2>
      <p>
        Your wallet address and your transactions can be seen by anyone, forever. Photos and videos are stored on
        Arweave and can&apos;t be deleted.
      </p>

      <h2>Scams</h2>
      <p>
        Watch out for fake giveaways, accounts copying a famous username, and links promising free SOL. ZAPR never
        sends you private messages asking you to connect or sign anything elsewhere. Report suspicious posts from
        their &ldquo;⋯&rdquo; menu.
      </p>

      <h2>Prototype software</h2>
      <p>
        ZAPR is a prototype: it can have bugs, be offline, or lose data. Rules (like post lifetime) can still change.
      </p>

      <h2>Contact</h2>
      <p>
        A security problem or a scam to report urgently: <ContactEmail />.
      </p>
    </LegalPage>
  );
}
