// Expired posts are deleted everywhere; the zap log they generated is kept.
// Runs the demo (file) store on the seed data, in a throwaway data directory.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { lifespanInfo } from "../src/lib/lifespan";

process.env.ZAPR_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "zapr-expiry-"));

test("expired posts are hidden from every read, then purged; zaps are kept", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  const store = createMemoryStore();
  const now = Date.now();

  // p17 (45 days old, 9 SOL) is long expired; p1 (2 h old) is alive.
  const feed = await store.listPosts({ limit: 100 });
  assert.ok(feed.length > 0);
  assert.ok(feed.every((p) => !lifespanInfo(p.createdAt, p.pumped, now).expired), "feed has no expired post");
  assert.ok(!feed.some((p) => p.id === "p17"));
  assert.equal(await store.getPost("p17"), null);
  assert.ok(await store.getPost("p1"));

  for (const q of [{ since: undefined }, { since: 0 }]) {
    const board = await store.leaderboardPosts({ kind: "posts", scope: "world", limit: 100, ...q });
    assert.ok(!board.some((r) => r.postId === "p17"), "leaderboard has no expired post");
    assert.ok(board.every((r) => r.post !== null));
  }

  const creatorBefore = (await store.getUserById("u2"))!.received;
  const purged = await store.purgeExpired(now);
  assert.ok(purged > 0);
  assert.deepEqual(await store.listComments("p17"), []);
  // The zap on p17 is still on record, and the creator keeps what was received.
  assert.ok(await store.getPumpBySignature("seed-p17-22"));
  assert.equal((await store.getUserById("u2"))!.received, creatorBefore);
  // Live posts are untouched.
  assert.ok(await store.getPost("p1"));
});
