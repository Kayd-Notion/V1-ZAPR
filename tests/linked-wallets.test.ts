// Linked wallets: more wallets that sign in to the same account (demo store,
// and Postgres too when ZAPR_TEST_POSTGRES=1 with DATABASE_URL set).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Keypair } from "@solana/web3.js";
import { checkTransferTx } from "../src/lib/verify-pump-core";
import type { Store } from "../src/lib/db/types";

process.env.ZAPR_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "zapr-linked-"));

const fresh = () => Keypair.generate().publicKey.toBase58();

async function scenario(store: Store) {
  const alice = await store.createUser({ handle: `alice_${Date.now() % 1e6}`, wallet: fresh() });
  const bob = await store.createUser({ handle: `bob_${Date.now() % 1e6}`, wallet: fresh() });
  const google = fresh();

  // Link: the new wallet then signs in to the same account; the main wallet stays.
  assert.equal(await store.linkWallet({ userId: alice.id, wallet: google, label: "Privy" }, 5), "linked");
  assert.equal((await store.getUserByWallet(google))?.id, alice.id);
  assert.equal((await store.getUserByWallet(alice.wallet))?.id, alice.id);
  assert.equal((await store.getUserById(alice.id))?.wallet, alice.wallet);
  assert.deepEqual(
    (await store.listLinkedWallets(alice.id)).map((w) => [w.wallet, w.label]),
    [[google, "Privy"]],
  );

  // Twice = already; someone else's wallet (main or linked) = taken.
  assert.equal(await store.linkWallet({ userId: alice.id, wallet: google, label: "Privy" }, 5), "already");
  assert.equal(await store.linkWallet({ userId: alice.id, wallet: alice.wallet, label: "" }, 5), "already");
  assert.equal(await store.linkWallet({ userId: bob.id, wallet: google, label: "Phantom" }, 5), "taken");
  assert.equal(await store.linkWallet({ userId: bob.id, wallet: alice.wallet, label: "Phantom" }, 5), "taken");
  assert.equal(await store.linkWallet({ userId: alice.id, wallet: bob.wallet, label: "Phantom" }, 5), "taken");

  // Limit.
  const more = [fresh(), fresh()];
  assert.equal(await store.linkWallet({ userId: bob.id, wallet: more[0], label: "Solflare" }, 1), "linked");
  assert.equal(await store.linkWallet({ userId: bob.id, wallet: more[1], label: "Solflare" }, 1), "limit");

  // Unlink: only your own; the wallet is then free again.
  assert.equal(await store.unlinkWallet(bob.id, google), false);
  assert.equal(await store.unlinkWallet(alice.id, google), true);
  assert.equal(await store.getUserByWallet(google), null);
  assert.deepEqual(await store.listLinkedWallets(alice.id), []);
  assert.equal(await store.linkWallet({ userId: bob.id, wallet: google, label: "Privy" }, 1), "limit");
  assert.equal(await store.unlinkWallet(bob.id, more[0]), true);
  assert.equal(await store.linkWallet({ userId: bob.id, wallet: google, label: "Privy" }, 1), "linked");
  assert.equal((await store.getUserByWallet(google))?.id, bob.id);
}

test("linked wallets (demo store)", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  await scenario(createMemoryStore());
});

test("linked wallets (Postgres)", { skip: process.env.ZAPR_TEST_POSTGRES !== "1" }, async () => {
  const { createPostgresStore } = await import("../src/lib/db/postgres");
  await scenario(createPostgresStore());
});

test("a zap paid from any wallet of the account passes the on-chain check", () => {
  const [main, linked, other, creator, founder] = [fresh(), fresh(), fresh(), fresh(), fresh()];
  const t = (payer: string) => ({
    meta: { err: null },
    transaction: {
      message: {
        instructions: [
          { program: "system", parsed: { type: "transfer", info: { source: payer, destination: creator, lamports: 70_000_000 } } },
          { program: "system", parsed: { type: "transfer", info: { source: payer, destination: founder, lamports: 30_000_000 } } },
        ],
      },
    },
  });
  const e = { pumperWallet: [main, linked], creatorWallet: creator, founderWallet: founder, amountSol: 0.1 };
  assert.equal(checkTransferTx(t(main), e).ok, true);
  assert.equal(checkTransferTx(t(linked), e).ok, true);
  assert.match(checkTransferTx(t(other), e).reason!, /payer/);
});
