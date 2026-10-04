// End-to-end check of real zaps against a running ZAPR server and a Solana
// validator, with the server's on-chain verification ON (not part of `npm test`).
//
//   solana-test-validator --reset &
//   PLATFORM=$(…a base58 address…)
//   PUMP_REQUIRE_ONCHAIN_VERIFY=true NEXT_PUBLIC_SOLANA_RPC=http://127.0.0.1:8899 \
//     NEXT_PUBLIC_FOUNDER_WALLET=$PLATFORM npm run dev -- -p 3102 &
//   BASE_URL=http://localhost:3102 RPC_URL=http://127.0.0.1:8899 PLATFORM=$PLATFORM \
//     node --import tsx tests/zap-e2e.local.mts
import assert from "node:assert/strict";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { Connection, Keypair, LAMPORTS_PER_SOL, type Transaction } from "@solana/web3.js";
import { sendPump } from "../src/lib/pump";

const BASE = process.env.BASE_URL ?? "http://localhost:3102";
const conn = new Connection(process.env.RPC_URL ?? "http://127.0.0.1:8899", "confirmed");
const PLATFORM = process.env.PLATFORM!;
assert.ok(PLATFORM, "PLATFORM (the server's NEXT_PUBLIC_FOUNDER_WALLET) is required");

async function fund(kp: Keypair, sol: number) {
  const sig = await conn.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
  const bh = await conn.getLatestBlockhash();
  await conn.confirmTransaction({ signature: sig, ...bh }, "confirmed");
}

/** A ZAPR user: signs in with its Solana keypair (message signature), picks a handle. */
async function user(kp: Keypair, handle: string) {
  const cookies: Record<string, string> = {};
  const call = async (path: string, init: RequestInit = {}) => {
    const r = await fetch(BASE + path, {
      ...init,
      headers: {
        "content-type": "application/json",
        cookie: Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; "),
      },
    });
    for (const sc of r.headers.getSetCookie()) {
      const [kv] = sc.split(";");
      const i = kv.indexOf("=");
      cookies[kv.slice(0, i)] = kv.slice(i + 1);
    }
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const wallet = kp.publicKey.toBase58();
  const n = await call(`/api/auth/nonce?wallet=${wallet}`);
  const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(n.body.message), kp.secretKey));
  await call("/api/auth/verify", { method: "POST", body: JSON.stringify({ wallet, signature: sig }) });
  const u = await call("/api/users", { method: "POST", body: JSON.stringify({ handle }) });
  return { call, kp, wallet, user: u.body.user };
}

/** Sends a real zap transaction (sign-only wallet, the app broadcasts). */
async function zapTx(from: Keypair, to: string, amountSol: number, platformBps: number) {
  const r = await sendPump({
    connection: conn,
    payer: from.publicKey,
    creatorWallet: to,
    amountSol,
    target: { platformWallet: PLATFORM, platformBps },
    sendTransaction: async () => {
      throw new Error("sign-only");
    },
    signTransaction: async (tx: Transaction) => {
      tx.partialSign(from);
      return tx;
    },
  });
  return r.signature;
}

const sfx = Date.now().toString(36).slice(-5);
const zk = Keypair.generate();
const ck = Keypair.generate();
await fund(zk, 2);
await fund(ck, 1);
const zapper = await user(zk, `zapper_${sfx}`);
const creator = await user(ck, `creator_${sfx}`);
const post = (await creator.call("/api/posts", { method: "POST", body: JSON.stringify({ text: "real zap test" }) })).body.post;

// 1. A real 0.05 SOL post zap, verified on-chain by the server.
{
  assert.equal((await zapper.call(`/api/posts/${post.id}/pump/prepare`, { method: "POST", body: JSON.stringify({ amount: 0.05 }) })).status, 200);
  const signature = await zapTx(zk, ck.publicKey.toBase58(), 0.05, 3000);
  const r = await zapper.call(`/api/posts/${post.id}/pump`, { method: "POST", body: JSON.stringify({ amount: 0.05, signature }) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.post.pumped, 0.05);
  console.log("✓ real post zap: verified on-chain and recorded (0.05 SOL)");

  const again = await zapper.call(`/api/posts/${post.id}/pump`, { method: "POST", body: JSON.stringify({ amount: 0.05, signature }) });
  assert.equal(again.body.code, "already_recorded");
  console.log("✓ same transaction twice: already_recorded (409)");

  const asCreatorZap = await zapper.call(`/api/users/${creator.user.handle}/zap`, { method: "POST", body: JSON.stringify({ amount: 0.05, signature }) });
  assert.equal(asCreatorZap.status, 409);
  console.log("✓ a post-zap transaction can't be recorded again as a creator zap");
}

// 2. Forgeries are refused.
{
  const small = await zapTx(zk, ck.publicKey.toBase58(), 0.01, 3000);
  const inflated = await zapper.call(`/api/posts/${post.id}/pump`, { method: "POST", body: JSON.stringify({ amount: 1, signature: small }) });
  assert.equal(inflated.status, 400);
  assert.equal(inflated.body.code, "verify_failed");
  console.log("✓ claiming 1 SOL with a 0.01 SOL transaction: refused");

  const someoneElses = await zapTx(ck, ck.publicKey.toBase58(), 0.01, 3000);
  const stolen = await zapper.call(`/api/posts/${post.id}/pump`, { method: "POST", body: JSON.stringify({ amount: 0.01, signature: someoneElses }) });
  assert.equal(stolen.status, 400);
  assert.match(stolen.body.error, /payer/);
  console.log("✓ submitting someone else's transaction: refused");

  const wrongSplit = await zapTx(zk, ck.publicKey.toBase58(), 0.01, 1000);
  const ws = await zapper.call(`/api/posts/${post.id}/pump`, { method: "POST", body: JSON.stringify({ amount: 0.01, signature: wrongSplit }) });
  assert.equal(ws.status, 400);
  console.log("✓ 90/10 transaction submitted as a 70/30 post zap: refused");

  const fake = bs58.encode(nacl.randomBytes(64));
  const t0 = Date.now();
  const missing = await zapper.call(`/api/posts/${post.id}/pump`, { method: "POST", body: JSON.stringify({ amount: 0.01, signature: fake }) });
  assert.equal(missing.status, 503);
  assert.equal(missing.body.code, "verify_pending");
  console.log(`✓ unknown transaction: retried for ${Math.round((Date.now() - t0) / 1000)}s, then verify_pending (503)`);
}

// 3. A real 0.1 SOL creator zap (90/10).
{
  assert.equal((await zapper.call(`/api/users/${creator.user.handle}/zap/prepare`, { method: "POST", body: JSON.stringify({ amount: 0.1 }) })).status, 200);
  const signature = await zapTx(zk, ck.publicKey.toBase58(), 0.1, 1000);
  const r = await zapper.call(`/api/users/${creator.user.handle}/zap`, { method: "POST", body: JSON.stringify({ amount: 0.1, signature }) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.user.zapped, 0.1);
  console.log("✓ real creator zap: verified on-chain and recorded (0.1 SOL, 90/10)");
}

// 4. The money history matches what happened on-chain.
{
  const a = (await creator.call("/api/activity?filter=in")).body.items;
  const kinds = a.map((x: { kind: string; amount: number }) => `${x.kind}:${x.amount}`).sort();
  assert.deepEqual(kinds, ["creator_zap_received:0.09", "zap_received:0.035"]);
  console.log("✓ creator's activity: +0.035 (70% of 0.05) and +0.09 (90% of 0.1)");
}

console.log("ALL OK");
