// Free follows ("Following" feed) and creator zaps (90/10, "Zapped" leaderboard).
// Runs the demo (file) store on the seed data, in a throwaway data directory.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CREATOR_ZAP_SPLIT, splitLamports } from "../src/lib/pump-config";

process.env.ZAPR_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "zapr-creators-"));

test("creator zaps split 90/10 by default", () => {
  assert.deepEqual(CREATOR_ZAP_SPLIT, { creatorBps: 9000, founderBps: 1000 });
  const { creatorLamports, founderLamports } = splitLamports(1_000_000_000, CREATOR_ZAP_SPLIT.founderBps);
  assert.equal(creatorLamports, 900_000_000);
  assert.equal(founderLamports, 100_000_000);
});

test("follow / unfollow drive the counts and the Abonnements feed", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  const store = createMemoryStore();

  assert.deepEqual(await store.listFollowingIds("u1"), []);
  await store.follow("u1", "u2");
  await store.follow("u1", "u2"); // idempotent
  await store.follow("u3", "u2");

  assert.deepEqual(await store.followStats("u2", "u1"), { followers: 2, following: 0, isFollowing: true });
  assert.deepEqual(await store.followStats("u2", null), { followers: 2, following: 0, isFollowing: false });
  assert.deepEqual(await store.followStats("u1", "u2"), { followers: 0, following: 1, isFollowing: false });
  assert.deepEqual(await store.listFollowingIds("u1"), ["u2"]);

  const feed = await store.listPosts({ limit: 100, authorIds: ["u2"] });
  assert.ok(feed.length > 0);
  assert.ok(feed.every((p) => p.userId === "u2"), "only followed creators");

  await store.unfollow("u1", "u2");
  assert.deepEqual(await store.listFollowingIds("u1"), []);
  assert.equal((await store.followStats("u2", "u1")).isFollowing, false);
});

test("creator zaps update totals, rank in Zapped, and never touch posts", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  const store = createMemoryStore();

  const postsBefore = await store.listPosts({ limit: 100, authorIds: ["u2"] });
  // Copies: the demo store hands out its live objects.
  const creatorBefore = { ...(await store.getUserById("u2"))! };
  const zapperBefore = { ...(await store.getUserById("u1"))! };

  await store.recordCreatorZap({
    creatorUserId: "u2",
    zapperUserId: "u1",
    amount: 0.5,
    creatorAmount: 0.45,
    founderAmount: 0.05,
    signature: "creator-zap-1",
    anonymous: false,
  });
  await store.recordCreatorZap({
    creatorUserId: "u3",
    zapperUserId: "u1",
    amount: 0.1,
    creatorAmount: 0.09,
    founderAmount: 0.01,
    signature: "creator-zap-2",
    anonymous: true,
  });
  await assert.rejects(
    store.recordCreatorZap({
      creatorUserId: "u2",
      zapperUserId: "u1",
      amount: 0.5,
      creatorAmount: 0.45,
      founderAmount: 0.05,
      signature: "creator-zap-1",
      anonymous: false,
    }),
    "a signature is only recorded once",
  );

  const creator = (await store.getUserById("u2"))!;
  assert.equal(creator.zapped, creatorBefore.zapped + 0.5);
  assert.equal(creator.received, creatorBefore.received, "post-zap total untouched");
  assert.equal((await store.getUserById("u1"))!.given, zapperBefore.given + 0.6);
  assert.ok(await store.getCreatorZapBySignature("creator-zap-1"));
  assert.equal(await store.getPumpBySignature("creator-zap-1"), null);

  // No effect on posts: same posts, same zap totals.
  const postsAfter = await store.listPosts({ limit: 100, authorIds: ["u2"] });
  assert.deepEqual(
    postsAfter.map((p) => [p.id, p.pumped]),
    postsBefore.map((p) => [p.id, p.pumped]),
  );

  for (const since of [undefined, Date.now() - 3600_000]) {
    const board = await store.leaderboardZapped({ kind: "zapped", scope: "world", limit: 10, since });
    assert.deepEqual(
      board.map((r) => [r.user.id, r.total]),
      [
        ["u2", 0.5],
        ["u3", 0.1],
      ],
    );
  }
  // A window that starts after the zaps is empty.
  assert.deepEqual(
    await store.leaderboardZapped({ kind: "zapped", scope: "world", limit: 10, since: Date.now() + 1000 }),
    [],
  );
  // Keyset pagination: the second page starts after the first row.
  const [first] = await store.leaderboardZapped({ kind: "zapped", scope: "world", limit: 1 });
  const page2 = await store.leaderboardZapped({
    kind: "zapped",
    scope: "world",
    limit: 1,
    cursor: { total: first.cursorTotal, id: first.user.id },
  });
  assert.deepEqual(page2.map((r) => r.user.id), ["u3"]);
});
