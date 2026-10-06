// On-chain zap check (pure part) and anti-spam counters.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkTransferTx } from "../src/lib/verify-pump-core";
import { CREATOR_ZAP_SPLIT } from "../src/lib/pump-config";

process.env.ZAPR_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "zapr-security-"));

const PAYER = "Payer1111111111111111111111111111111111111";
const CREATOR = "Creator11111111111111111111111111111111111";
const FOUNDER = "Founder11111111111111111111111111111111111";
const transfer = (source: string, destination: string, lamports: number) => ({
  program: "system",
  parsed: { type: "transfer", info: { source, destination, lamports } },
});
const tx = (...ixs: object[]) => ({ meta: { err: null }, transaction: { message: { instructions: ixs } } });
const expect = { pumperWallet: PAYER, creatorWallet: CREATOR, founderWallet: FOUNDER, amountSol: 0.1 };

test("a real 70/30 zap transaction passes", () => {
  assert.deepEqual(checkTransferTx(tx(transfer(PAYER, CREATOR, 70_000_000), transfer(PAYER, FOUNDER, 30_000_000)), expect), { ok: true });
});

test("a creator zap is checked against the 90/10 split", () => {
  const e = { ...expect, amountSol: 0.5, founderBps: CREATOR_ZAP_SPLIT.founderBps };
  assert.equal(checkTransferTx(tx(transfer(PAYER, CREATOR, 450_000_000), transfer(PAYER, FOUNDER, 50_000_000)), e).ok, true);
  assert.equal(checkTransferTx(tx(transfer(PAYER, CREATOR, 350_000_000), transfer(PAYER, FOUNDER, 150_000_000)), e).ok, false);
});

test("forged or wrong transactions are refused", () => {
  // Someone else paid (replaying another user's transaction).
  assert.match(
    checkTransferTx(tx(transfer("Other1111", CREATOR, 70_000_000), transfer("Other1111", FOUNDER, 30_000_000)), expect).reason!,
    /payer/,
  );
  // Claiming 1 SOL with a 0.1 SOL transaction.
  assert.match(
    checkTransferTx(tx(transfer(PAYER, CREATOR, 70_000_000), transfer(PAYER, FOUNDER, 30_000_000)), { ...expect, amountSol: 1 }).reason!,
    /creator share/,
  );
  // Platform skipped.
  assert.match(checkTransferTx(tx(transfer(PAYER, CREATOR, 70_000_000)), expect).reason!, /platform share/);
  // Paid to someone else than the post's creator.
  assert.equal(checkTransferTx(tx(transfer(PAYER, "Elsewhere1", 70_000_000), transfer(PAYER, FOUNDER, 30_000_000)), expect).ok, false);
  // Failed on-chain.
  const failed = { ...tx(transfer(PAYER, CREATOR, 70_000_000), transfer(PAYER, FOUNDER, 30_000_000)), meta: { err: { InstructionError: [0, "x"] } } };
  assert.match(checkTransferTx(failed, expect).reason!, /failed/);
  // Non-system instructions are ignored.
  assert.equal(checkTransferTx(tx({ program: "spl-token", parsed: { type: "transfer", info: { source: PAYER } } }), expect).ok, false);
});

test("anti-spam counters count per key inside a window, then reset", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  const store = createMemoryStore();
  const counts = [];
  for (let i = 0; i < 4; i++) counts.push(await store.hitRateLimit("post:test-user", 60_000));
  assert.deepEqual(counts, [1, 2, 3, 4]);
  assert.equal(await store.hitRateLimit("post:other-user", 60_000), 1, "per key");
  // A tiny window has always rolled over after a short wait.
  await store.hitRateLimit("tiny:x", 5);
  await new Promise((r) => setTimeout(r, 12));
  assert.equal(await store.hitRateLimit("tiny:x", 5), 1);
});

test("on-chain verification: on for every Vercel deployment (previews too), off locally, explicit setting wins", async () => {
  const { onchainVerifyDefault } = await import("../src/lib/verify-pump-core");
  assert.equal(onchainVerifyDefault({ VERCEL: "1", VERCEL_ENV: "production" }), true);
  assert.equal(onchainVerifyDefault({ VERCEL: "1", VERCEL_ENV: "preview" }), true);
  assert.equal(onchainVerifyDefault({}), false);
  assert.equal(onchainVerifyDefault({ VERCEL: "1", PUMP_REQUIRE_ONCHAIN_VERIFY: "false" }), false);
  assert.equal(onchainVerifyDefault({ PUMP_REQUIRE_ONCHAIN_VERIFY: "true" }), true);
});
