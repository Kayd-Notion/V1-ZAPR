// Leaderboard rules (founder's decisions, October 2026): a zap counts for its
// full amount (100 %), and a self-zap (from any of your wallets) is a zap like
// any other: it extends your post's life AND counts in the leaderboards.
// Demo store, and Postgres too when ZAPR_TEST_POSTGRES=1 with DATABASE_URL set.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import type { Store } from "../src/lib/db/types";

process.env.ZAPR_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "zapr-ranking-"));

const wallet = () => Keypair.generate().publicKey.toBase58();
const near = (a: number | undefined, b: number) => a !== undefined && Math.abs(a - b) < 1e-9;
let n = 0;
const handle = (p: string) => `${p}_${Date.now().toString(36).slice(-4)}${(n++).toString(36)}`;

async function scenario(store: Store) {
  const country = `T${randomUUID().slice(0, 6)}`; // a "country" nobody else uses
  const alice = await store.createUser({ handle: handle("alice"), wallet: wallet(), country });
  const bob = await store.createUser({ handle: handle("bob"), wallet: wallet(), country });
  const carol = await store.createUser({ handle: handle("carol"), wallet: wallet(), country });
  // Alice also signs in with a second wallet: her zaps are hers whichever wallet pays.
  assert.equal(await store.linkWallet({ userId: alice.id, wallet: wallet(), label: "Privy" }, 5), "linked");

  const t0 = Date.now() - 1;
  const post = await store.createPost({ userId: alice.id, text: "rank me", country });
  const selfOnly = await store.createPost({ userId: carol.id, text: "only my own zaps", country });
  const zap = (postId: string, pumperUserId: string, amount: number) =>
    store.recordPump({
      postId,
      pumperUserId,
      amount,
      creatorAmount: amount * 0.7,
      founderAmount: amount * 0.3,
      signature: `rank-${randomUUID()}`,
      anonymous: false,
    });
  const direct = (creatorUserId: string, zapperUserId: string, amount: number) =>
    store.recordCreatorZap({
      creatorUserId,
      zapperUserId,
      amount,
      creatorAmount: amount * 0.9,
      founderAmount: amount * 0.1,
      signature: `rank-${randomUUID()}`,
      anonymous: false,
    });

  await zap(post.id, bob.id, 1); // counts 1 (not the 0.7 creator share)
  await zap(post.id, alice.id, 2); // self-zap (from her linked wallet or not): counts 2, like any zap
  await zap(post.id, carol.id, 0.5); // counts 0.5
  const last = await zap(selfOnly.id, carol.id, 3); // a post zapped only by its author: counts 3
  await direct(alice.id, bob.id, 0.2); // counts 0.2 (not 0.18)
  // (A direct zap to yourself is refused by the API, so it never reaches the store.)

  // Every zap extends the post's life.
  assert.ok(near((await store.getPost(post.id))!.pumped, 3.5));
  assert.ok(near(last.post.pumped, 3));

  for (const since of [undefined, t0]) {
    const label = since === undefined ? "all time" : "period";
    // Posts.
    const posts = await store.leaderboardPosts({ kind: "posts", scope: "country", country, limit: 50, since });
    assert.deepEqual(
      posts.map((r) => [r.postId, r.total]),
      [
        [post.id, 3.5],
        [selfOnly.id, 3],
      ],
      `${label}: posts board = 100 % of every zap, self-zaps included`,
    );
    const world = await store.leaderboardPosts({ kind: "posts", scope: "world", limit: 1000, since });
    assert.ok(near(world.find((r) => r.postId === post.id)?.total, 3.5));
    assert.ok(near(world.find((r) => r.postId === selfOnly.id)?.total, 3), `${label}: a post zapped only by its author is ranked`);

    // Creators.
    const creators = await store.leaderboardCreators({ kind: "creators", scope: "country", country, limit: 50, since });
    assert.deepEqual(
      creators.map((r) => [r.user.handle, r.total]),
      [
        [alice.handle, 3.7],
        [carol.handle, 3],
      ],
      `${label}: creators board = 100 % of post zaps (self-zaps included) + direct zaps`,
    );
  }

  // Pagination keeps working on the new totals.
  await zap(selfOnly.id, bob.id, 0.25);
  const page1 = await store.leaderboardPosts({ kind: "posts", scope: "country", country, limit: 1 });
  const page2 = await store.leaderboardPosts({
    kind: "posts",
    scope: "country",
    country,
    limit: 1,
    cursor: { total: page1[0].cursorTotal, id: page1[0].postId },
  });
  assert.deepEqual(
    [...page1, ...page2].map((r) => [r.postId, r.total]),
    [
      [post.id, 3.5],
      [selfOnly.id, 3.25],
    ],
  );
  // A window after every zap is empty.
  assert.deepEqual(
    await store.leaderboardCreators({ kind: "creators", scope: "country", country, limit: 50, since: Date.now() + 1000 }),
    [],
  );
}

test("leaderboards: 100 % of each zap, self-zaps included (demo store)", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  await scenario(createMemoryStore());
});

test("leaderboards: 100 % of each zap, self-zaps included (Postgres)", { skip: process.env.ZAPR_TEST_POSTGRES !== "1" }, async () => {
  const { createPostgresStore } = await import("../src/lib/db/postgres");
  await scenario(createPostgresStore());
});

test("rankings check on a consistent store reports nothing wrong", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  const st = await createMemoryStore().adminStats();
  assert.equal(st.unattributedZaps, 0);
  assert.equal(st.postsOutOfSync, 0);
});

test("demo data: every post's total matches its zap log", async () => {
  const { buildSeed } = await import("../src/lib/db/seed");
  const seed = buildSeed();
  for (const p of seed.posts) {
    const logged = seed.pumps.filter((pm) => pm.postId === p.id).reduce((t, pm) => t + pm.amount, 0);
    assert.ok(near(logged, p.pumped), `${p.id}: ${logged} vs ${p.pumped}`);
  }
});
