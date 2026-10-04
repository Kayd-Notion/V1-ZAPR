// Frontend unit tests for the pump product rules: `npm test` (root).
import { test } from "node:test";
import assert from "node:assert/strict";
import { humanizePumpError } from "../src/lib/pump-errors";
import { formatSol, pumpRequirements, pumpedSolForLifespan } from "../src/lib/pump-rules";
import {
  MIN_CREATOR_ZAP_SOL,
  MIN_PUMP_SOL,
  PUMP_QUOTE_SLACK_SECONDS,
  PUMP_SAVE_MIN_LIFETIME_SECONDS,
  QUICK_ZAP_AMOUNTS,
} from "../src/lib/pump-config";
import { expiresAt, lifespanHours, nextBoost, zapBoostHours } from "../src/lib/lifespan";

const H = 3_600_000;
const NOW = Date.parse("2026-09-01T00:00:00Z");

// ---- Rule 3 ----------------------------------------------------------------
test("rule 3: MIN_PUMP_SOL is 0.005 and quick amounts (≥ 0.01) are above it", () => {
  assert.equal(MIN_PUMP_SOL, 0.005);
  assert.deepEqual([...QUICK_ZAP_AMOUNTS], [0.01, 0.05, 0.1, 0.5, 1]);
  for (const quick of QUICK_ZAP_AMOUNTS) {
    assert.ok(quick >= MIN_PUMP_SOL, "post zap minimum");
    assert.ok(quick >= MIN_CREATOR_ZAP_SOL, "creator zap minimum");
  }
  // Every live post requires at least the global minimum.
  const r = pumpRequirements({ createdAt: NOW - 2 * H, pumped: 0, expiresAt: NOW + 22 * H }, NOW);
  assert.equal(r.status, "active");
  assert.equal(r.requiredMinSol, MIN_PUMP_SOL);
});

test("rule 3: the rent-exempt failure becomes a readable message (real Solana errors)", () => {
  // Exact message captured from a real Solana validator (web3.js
  // SendTransactionError) for a 0.0007 SOL transfer to an empty wallet.
  const samples = [
    new Error(
      "Simulation failed. \nMessage: Transaction simulation failed: Transaction results in an account (1) with insufficient funds for rent. \nLogs: \n[\n  \"Program 11111111111111111111111111111111 invoke [1]\",\n  \"Program 11111111111111111111111111111111 success\"\n]. \nCatch the `SendTransactionError` and call `getLogs()` on it for full details.",
    ),
    new Error('failed to send transaction: {"InsufficientFundsForRent":{"account_index":2}}'),
  ];
  for (const e of samples) {
    const msg = humanizePumpError(e);
    assert.match(msg, /receiving wallets is empty/);
    assert.doesNotMatch(msg, /InsufficientFundsForRent|simulation|account_index/);
  }
});

test("pump errors: other wallet/network failures are readable too", () => {
  assert.match(humanizePumpError(new Error("Attempt to debit an account but found no record of a prior credit.")), /Not enough SOL/);
  assert.match(humanizePumpError(new Error("User rejected the request.")), /canceled/);
  assert.match(humanizePumpError(new Error("Blockhash not found")), /expired/);
  assert.match(humanizePumpError(new Error("Simulation failed: \"AccountNotFound\"")), /Not enough SOL/);
  assert.match(humanizePumpError(new Error("Unexpected error")), /Solana Devnet/);
  assert.equal(humanizePumpError(new Error("something else")), "something else");
});

// ---- Rule 2 ----------------------------------------------------------------
test("lifespan: 24 h base, then milestones inside every SOL (3 h, 3 h, 6 h, 12 h)", () => {
  const cases: [number, number][] = [
    [0, 24], [0.09, 24], [0.1, 27], [0.2, 27], [0.25, 30], [0.49, 30], [0.5, 36], [0.99, 36],
    [1, 48], [1.1, 51], [1.25, 54], [1.5, 60], [2, 72], [2.5, 84], [10, 264], [100.1, 2427],
  ];
  for (const [sol, hours] of cases) assert.equal(lifespanHours(sol), hours, `${sol} SOL`);
  // Float sums land on the milestone exactly (0.1 + 0.2 + 0.2 = 0.5).
  assert.equal(lifespanHours(0.1 + 0.2 + 0.2), 36);
});

test("lifespan: next milestone and what a zap adds", () => {
  assert.deepEqual(nextBoost(0), { atSol: 0.1, hours: 3 });
  assert.deepEqual(nextBoost(0.8), { atSol: 1, hours: 12 });
  assert.deepEqual(nextBoost(1), { atSol: 1.1, hours: 3 });
  assert.deepEqual(nextBoost(3.3), { atSol: 3.5, hours: 6 });
  assert.equal(zapBoostHours(0.8, 0.1), 0, "0.8 → 0.9: no milestone, the gauge fills");
  assert.equal(zapBoostHours(0.8, 0.3), 15, "0.8 → 1.1: whole SOL (+12 h) and 1.10 (+3 h)");
  assert.equal(zapBoostHours(0.8, 2.3), 63, "0.8 → 3.1: SOL 1, 2, 3 (+12 h each) + 2.10/2.25/2.50 + 3.10");
  assert.equal(zapBoostHours(0, 1), 24, "a full SOL is always +24 h");
  assert.equal(zapBoostHours(5, 1), 24, "…at any level: no diminishing returns");
});

test("rule 2: inverse of the lifespan (smallest milestone reaching a lifespan)", () => {
  for (const sol of [0, 0.1, 0.25, 0.5, 1, 1.1, 2.5, 7, 100.25]) {
    assert.ok(Math.abs(pumpedSolForLifespan(lifespanHours(sol)) - sol) < 1e-9, `sol=${sol}`);
  }
  // Between milestones, the inverse is the milestone that already gives those hours.
  assert.equal(pumpedSolForLifespan(lifespanHours(0.3)), 0.25);
  assert.equal(pumpedSolForLifespan(25), 0.1, "1 h more than the base needs the first milestone");
});

test("rule 2: expired post → minimum that saves it", () => {
  const post = { createdAt: NOW - 30 * H, pumped: 0, expiresAt: NOW - 6 * H }; // expired 6h ago
  const r = pumpRequirements(post, NOW);
  assert.equal(r.status, "expired");
  // 31 h of life needed (30 h elapsed + 1 h): 7 h of boost → the 0.50 milestone (3+3+6 h).
  assert.equal(r.minToSaveSol, 0.5);
  assert.equal(r.requiredMinSol, 0.5);
  // Paying it gives the post at least PUMP_SAVE_MIN_LIFETIME_SECONDS of life…
  assert.ok(expiresAt(post.createdAt, 0.5) >= NOW + PUMP_SAVE_MIN_LIFETIME_SECONDS * 1000);
  // …and just under the milestone would not save it.
  assert.ok(expiresAt(post.createdAt, 0.49) < NOW + PUMP_SAVE_MIN_LIFETIME_SECONDS * 1000);
});

test("rule 2: the modal's amount stays valid for a few minutes (quote slack)", () => {
  const post = { createdAt: NOW - 30 * H, pumped: 0, expiresAt: NOW - 6 * H };
  const quoted = pumpRequirements(post, NOW, PUMP_QUOTE_SLACK_SECONDS).requiredMinSol;
  const atSigning = pumpRequirements(post, NOW + 4 * 60_000).requiredMinSol;
  assert.ok(quoted >= atSigning);
});

test("rule 2: a purged post has no pump option", () => {
  const r = pumpRequirements({ createdAt: NOW - 30 * H, pumped: 0, expiresAt: NOW - 6 * H, deleted: true }, NOW);
  assert.equal(r.status, "deleted");
});

test("formatSol", () => {
  assert.equal(formatSol(0.292), "0.292");
  assert.equal(formatSol(0.005), "0.005");
  assert.equal(formatSol(1), "1");
});
