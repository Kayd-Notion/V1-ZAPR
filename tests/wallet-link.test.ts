// Linking rules (lib/wallet-link.ts), the way the /api/wallets routes use them:
// a Phantom user links Google (a simulated Privy wallet), a Google user links
// Phantom, a second Phantom account, and every refusal. Demo store, and
// Postgres too when ZAPR_TEST_POSTGRES=1 with DATABASE_URL set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { buildLinkMessage, buildSignInMessage } from "../src/lib/auth-core";
import {
  LINK_CHALLENGE_TTL_MS,
  MAX_LINKED_WALLETS,
  cleanLabel,
  linkWalletToAccount,
  sessionUser,
  unlinkWalletFromAccount,
  walletsOfUser,
  type LinkChallenge,
} from "../src/lib/wallet-link";
import { parsePrivyConfig } from "../src/lib/social-login";
import type { Store, User } from "../src/lib/db/types";

process.env.ZAPR_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "zapr-wallet-link-"));

/** A wallet that can sign (Phantom, or the Google wallet Privy creates: same thing for ZAPR). */
function wallet(label: "Phantom" | "Privy" | "Solflare") {
  const kp = nacl.sign.keyPair();
  const address = bs58.encode(kp.publicKey);
  const sign = (message: string) => bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), kp.secretKey));
  return { address, label, sign };
}
type W = ReturnType<typeof wallet>;

let n = 0;
const uniq = () => `${Date.now().toString(36).slice(-4)}${(n++).toString(36)}`;

async function account(store: Store, w: W): Promise<User> {
  return store.createUser({ handle: `t_${uniq()}`, wallet: w.address });
}

/** What /api/wallets/challenge puts in the cookie, and the signed POST that follows. */
function challengeFor(me: User, w: W, issuedAt = Date.now()): LinkChallenge {
  return { nonce: `n${uniq()}`, wallet: w.address, issuedAt, purpose: "link", userId: me.id };
}
async function link(store: Store, me: User, w: W, opts: { challenge?: LinkChallenge | null; signature?: string } = {}) {
  const challenge = opts.challenge === undefined ? challengeFor(me, w) : opts.challenge;
  const signature =
    opts.signature ??
    (challenge
      ? w.sign(buildLinkMessage({ wallet: w.address, handle: me.handle, nonce: challenge.nonce, issuedAt: challenge.issuedAt }))
      : "x");
  return linkWalletToAccount(store, { me, challenge, wallet: w.address, signature, label: w.label });
}
const signedIn = (store: Store, w: W) => store.getUserByWallet(w.address);

async function scenario(store: Store) {
  // 1. Phantom user links Google; both open the same account.
  const phantom = wallet("Phantom");
  const google = wallet("Privy");
  const alice = await account(store, phantom);
  assert.deepEqual(await link(store, alice, google), { ok: true, already: false });
  assert.equal((await signedIn(store, google))?.id, alice.id);
  assert.equal((await signedIn(store, phantom))?.id, alice.id);
  assert.deepEqual(await walletsOfUser(store, alice), [phantom.address, google.address]);
  assert.equal((await store.listLinkedWallets(alice.id))[0].label, "Privy");
  // Zaps still go to the main wallet.
  assert.equal((await store.getUserById(alice.id))?.wallet, phantom.address);

  // 2. Google user (account created with the Google wallet) links Phantom.
  const google2 = wallet("Privy");
  const phantom2 = wallet("Phantom");
  const bob = await account(store, google2);
  assert.equal((await link(store, bob, phantom2)).ok, true);
  assert.equal((await signedIn(store, phantom2))?.id, bob.id);

  // 3. A second Phantom account for the same person.
  const phantom3 = wallet("Phantom");
  assert.equal((await link(store, alice, phantom3)).ok, true);
  assert.equal((await walletsOfUser(store, alice)).length, 3);

  // Linking again = already there (no error, no duplicate).
  assert.deepEqual(await link(store, alice, google), { ok: true, already: true });
  assert.deepEqual(await link(store, alice, phantom), { ok: true, already: true });

  // 4. Refusals.
  // A wallet that has its own account (main or linked) can't be taken.
  const taken = await link(store, alice, google2);
  assert.equal(taken.ok, false);
  assert.equal(!taken.ok && taken.code, "wallet_taken");
  assert.match(!taken.ok ? taken.error : "", new RegExp(`@${bob.handle}`));
  assert.equal((await link(store, bob, google)).ok || "refused", "refused");
  assert.equal((await signedIn(store, google))?.id, alice.id);

  const fresh = wallet("Solflare");
  const expect = async (r: Awaited<ReturnType<typeof link>>, status: number) => {
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.status, status);
  };
  // No challenge, a sign-in challenge, a challenge for another account or wallet, an old one.
  await expect(await link(store, alice, fresh, { challenge: null }), 401);
  await expect(await link(store, alice, fresh, { challenge: { ...challengeFor(alice, fresh), purpose: undefined } }), 401);
  await expect(await link(store, alice, fresh, { challenge: { ...challengeFor(alice, fresh), userId: bob.id } }), 401);
  await expect(await link(store, alice, fresh, { challenge: { ...challengeFor(alice, fresh), wallet: phantom.address } }), 401);
  await expect(
    await link(store, alice, fresh, { challenge: challengeFor(alice, fresh, Date.now() - LINK_CHALLENGE_TTL_MS - 1000) }),
    401,
  );
  // Signed by another wallet, or the sign-in message replayed as a link.
  const c = challengeFor(alice, fresh);
  await expect(
    await link(store, alice, fresh, {
      challenge: c,
      signature: phantom.sign(buildLinkMessage({ wallet: fresh.address, handle: alice.handle, nonce: c.nonce, issuedAt: c.issuedAt })),
    }),
    401,
  );
  await expect(
    await link(store, alice, fresh, {
      challenge: c,
      signature: fresh.sign(buildSignInMessage({ wallet: fresh.address, nonce: c.nonce, issuedAt: c.issuedAt })),
    }),
    401,
  );
  // The link message names the account: a signature for @alice can't link to @bob.
  const forAlice = fresh.sign(buildLinkMessage({ wallet: fresh.address, handle: alice.handle, nonce: c.nonce, issuedAt: c.issuedAt }));
  await expect(await link(store, bob, fresh, { challenge: { ...c, userId: bob.id }, signature: forAlice }), 401);
  // Not a wallet address.
  const bad = await linkWalletToAccount(store, { me: alice, challenge: c, wallet: "nope", signature: "x", label: "" });
  assert.equal(!bad.ok && bad.status, 400);
  // Suspended account.
  await expect(await link(store, { ...alice, banned: true }, fresh), 403);
  assert.equal(await signedIn(store, fresh), null);

  // Limit.
  const carol = await account(store, wallet("Phantom"));
  for (let i = 0; i < MAX_LINKED_WALLETS; i++) assert.equal((await link(store, carol, wallet("Solflare"))).ok, true);
  const over = await link(store, carol, wallet("Solflare"));
  assert.equal(!over.ok && over.code, "wallet_limit");

  // 5. Unlink rules.
  const notMain = await unlinkWalletFromAccount(store, { me: alice, sessionWallet: phantom.address, wallet: phantom.address });
  assert.equal(!notMain.ok && notMain.status, 400);
  const inUse = await unlinkWalletFromAccount(store, { me: alice, sessionWallet: google.address, wallet: google.address });
  assert.equal(!inUse.ok && inUse.code, "wallet_in_use");
  const notMine = await unlinkWalletFromAccount(store, { me: bob, sessionWallet: google2.address, wallet: google.address });
  assert.equal(!notMine.ok && notMine.status, 404);

  // A session opened with Google is valid... until Google is unlinked from the Phantom session.
  const googleSession = { wallet: google.address, userId: alice.id };
  assert.equal((await sessionUser(store, googleSession))?.id, alice.id);
  assert.deepEqual(await unlinkWalletFromAccount(store, { me: alice, sessionWallet: phantom.address, wallet: google.address }), {
    ok: true,
  });
  assert.equal(await sessionUser(store, googleSession), null);
  assert.equal((await sessionUser(store, { wallet: phantom.address, userId: alice.id }))?.id, alice.id);
  // A forged session (someone else's wallet with alice's id) is no session.
  assert.equal(await sessionUser(store, { wallet: phantom2.address, userId: alice.id }), null);
  assert.equal(await sessionUser(store, { wallet: phantom.address, userId: null }), null);

  // The unlinked Google wallet is free again: it can now create its own account...
  assert.equal(await signedIn(store, google), null);
  // ...but a wallet linked to someone can't create an account.
  await assert.rejects(store.createUser({ handle: `t_${uniq()}`, wallet: phantom3.address }));
}

test("linking Google and wallets (demo store)", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  await scenario(createMemoryStore());
});

test("linking Google and wallets (Postgres)", { skip: process.env.ZAPR_TEST_POSTGRES !== "1" }, async () => {
  const { createPostgresStore } = await import("../src/lib/db/postgres");
  await scenario(createPostgresStore());
});

test("wallet labels are cleaned", () => {
  assert.equal(cleanLabel("  Phantom\n"), "Phantom");
  assert.equal(cleanLabel("x".repeat(80)).length, 40);
  assert.equal(cleanLabel(42), "");
});

test("Privy App ID check: missing or mistyped turns Google sign-in off, with a reason", () => {
  const ok = "cm1abcdefghijklmnopqrstuv";
  assert.equal(ok.length, 25);
  assert.deepEqual(parsePrivyConfig(ok, undefined), { appId: ok, providers: ["google"], problem: null });
  // Pasted with quotes or spaces: still fine.
  assert.equal(parsePrivyConfig(` "${ok}" `, "google").appId, ok);
  // Missing.
  const missing = parsePrivyConfig(undefined, "google");
  assert.equal(missing.appId, "");
  assert.deepEqual(missing.providers, []);
  assert.match(missing.problem!, /not set/);
  // Too short, too long, a URL, a secret pasted by mistake.
  for (const wrong of ["cm1abc", ok + "x", "https://dashboard.privy.io/apps/x", "privy_app_secret_abc123"]) {
    const c = parsePrivyConfig(wrong, "google");
    assert.equal(c.appId, "", wrong);
    assert.deepEqual(c.providers, []);
    assert.match(c.problem!, /doesn't look like a Privy App ID/);
  }
  // Providers.
  assert.deepEqual(parsePrivyConfig(ok, " Google ").providers, ["google"]);
  const odd = parsePrivyConfig(ok, "google,facebook");
  assert.deepEqual(odd.providers, ["google"]);
  assert.match(odd.problem!, /facebook/);
  assert.deepEqual(parsePrivyConfig(ok, "facebook").providers, []);
});
