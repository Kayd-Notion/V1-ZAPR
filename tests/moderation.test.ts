// Reports, hiding posts, banning users, admin stats (demo store).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.ZAPR_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "zapr-moderation-"));

test("reports: one per user and target, grouped for the admins, then resolved", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  const store = createMemoryStore();
  const post = await store.createPost({ userId: "u3", text: "free SOL, connect here" });
  const comment = await store.addComment({ postId: post.id, userId: "u4", text: "spam spam" });

  const r = (reporterId: string, targetType: "post" | "comment", targetId: string, reason: "scam" | "spam") =>
    store.createReport({ reporterId, targetType, targetId, reason, details: reporterId === "u1" ? "drainer link" : "" });
  assert.equal(await r("u1", "post", post.id, "scam"), "created");
  assert.equal(await r("u1", "post", post.id, "scam"), "duplicate");
  assert.equal(await r("u2", "post", post.id, "spam"), "created");
  assert.equal(await r("u2", "comment", comment.id, "spam"), "created");
  assert.equal(await r("u2", "post", "nope", "spam"), "not_found");

  const open = await store.listOpenReports(10);
  assert.equal(open.length, 2);
  assert.deepEqual([open[0].targetType, open[0].count, [...open[0].reasons].sort()], ["post", 2, ["scam", "spam"]]);
  assert.deepEqual(open[0].details, ["drainer link"]);
  assert.equal(open[0].author!.handle, "devSol");
  assert.equal(open[1].text, "spam spam");
  assert.equal(open[1].postId, post.id);
  assert.equal((await store.adminStats()).openReports, 2);

  assert.equal(await store.resolveReports("comment", comment.id, "dismissed"), 1);
  assert.equal(await store.resolveReports("comment", comment.id, "dismissed"), 0, "already closed");
  assert.equal((await store.listOpenReports(10)).length, 1);
});

test("a hidden post disappears from every read, and can come back", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  const store = createMemoryStore();
  const post = await store.createPost({ userId: "u5", text: "hide me #hidetest", tags: ["#hidetest"] });

  assert.equal(await store.setPostHidden(post.id, true), true);
  assert.equal(await store.getPost(post.id), null);
  assert.ok(await store.getPost(post.id, { includeHidden: true }), "still recordable for an in-flight zap");
  assert.ok(!(await store.listPosts({ limit: 200 })).some((p) => p.id === post.id));
  assert.equal((await store.search("#hidetest", 10)).posts.length, 0);
  assert.ok((await store.listHiddenPosts(10)).some((p) => p.id === post.id));
  const board = await store.leaderboardPosts({ kind: "posts", scope: "world", limit: 200 });
  assert.ok(!board.some((b) => b.postId === post.id));

  await store.setPostHidden(post.id, false);
  assert.ok(await store.getPost(post.id));
});

test("a banned user's posts, comments and ranking disappear; unbanning restores them", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  const store = createMemoryStore();
  const post = await store.createPost({ userId: "u6", text: "pixel stuff" });
  const other = await store.createPost({ userId: "u1", text: "host post" });
  await store.addComment({ postId: other.id, userId: "u6", text: "comment by u6" });

  assert.equal(await store.setUserBanned("u6", true), true);
  assert.equal((await store.getUserById("u6"))!.banned, true);
  assert.equal(await store.getPost(post.id), null);
  assert.deepEqual(await store.listPosts({ limit: 100, authorId: "u6" }), []);
  assert.ok(!(await store.listComments(other.id)).some((c) => c.userId === "u6"));
  assert.ok(!(await store.search("pixelzap", 10)).users.length);
  const creators = await store.leaderboardCreators({ kind: "creators", scope: "world", limit: 100 });
  assert.ok(!creators.some((c) => c.user.id === "u6"));
  assert.deepEqual((await store.listBannedUsers(10)).map((u) => u.handle), ["pixelzap"]);
  assert.equal((await store.adminStats()).bannedUsers, 1);

  await store.setUserBanned("u6", false);
  assert.ok(await store.getPost(post.id));
});

test("admins can remove any comment; stats add up the zap logs", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  const store = createMemoryStore();
  const post = await store.createPost({ userId: "u1", text: "stats" });
  const c = await store.addComment({ postId: post.id, userId: "u2", text: "bad" });
  assert.equal(await store.removeComment(c.id), true);
  assert.equal((await store.getPost(post.id))!.comments, 0);

  const before = await store.adminStats();
  await store.recordPump({ postId: post.id, pumperUserId: "u2", amount: 1, creatorAmount: 0.7, founderAmount: 0.3, signature: "stats-1", anonymous: false });
  const after = await store.adminStats();
  assert.equal(after.zaps, before.zaps + 1);
  assert.equal(after.zaps24h, before.zaps24h + 1);
  assert.ok(Math.abs(after.platformRevenue - before.platformRevenue - 0.3) < 1e-9);
  assert.ok(Math.abs(after.solZapped - before.solZapped - 1) < 1e-9);
});
