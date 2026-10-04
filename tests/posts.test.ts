// Deleting posts and comments, search, profile pictures, media URLs.
// Runs the demo (file) store on the seed data, in a throwaway data directory.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isIrysUrl } from "../src/lib/media-url";

process.env.ZAPR_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "zapr-posts-"));

const IRYS = "https://gateway.irys.xyz/" + "A".repeat(43);

test("only Irys gateway URLs are accepted for media and pictures", () => {
  assert.equal(isIrysUrl(IRYS), true);
  assert.equal(isIrysUrl("https://evil.example/pixel.gif"), false);
  assert.equal(isIrysUrl("https://gateway.irys.xyz/../x"), false);
  assert.equal(isIrysUrl("javascript:alert(1)"), false);
  assert.equal(isIrysUrl(null), false);
});

test("a post can be deleted by its author only, and only before any zap", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  const store = createMemoryStore();

  const post = await store.createPost({ userId: "u1", text: "delete me #bye" });
  await store.addComment({ postId: post.id, userId: "u2", text: "nice" });

  assert.equal(await store.deletePost(post.id, "u2"), "not_author");
  assert.equal(await store.deletePost("nope", "u1"), "not_found");
  assert.equal(await store.deletePost(post.id, "u1"), "deleted");
  assert.equal(await store.getPost(post.id), null);
  assert.deepEqual(await store.listComments(post.id), [], "its comments go with it");

  const zapped = await store.createPost({ userId: "u1", text: "keep me" });
  await store.recordPump({
    postId: zapped.id,
    pumperUserId: "u2",
    amount: 0.01,
    creatorAmount: 0.007,
    founderAmount: 0.003,
    signature: "sig-delete-test",
    anonymous: false,
  });
  assert.equal(await store.deletePost(zapped.id, "u1"), "has_zaps");
  assert.ok(await store.getPost(zapped.id), "a zapped post stays");
});

test("a comment can be deleted by its author or by the post's author", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  const store = createMemoryStore();
  const post = await store.createPost({ userId: "u1", text: "comments" });
  const a = await store.addComment({ postId: post.id, userId: "u2", text: "from u2" });
  const b = await store.addComment({ postId: post.id, userId: "u3", text: "from u3" });

  assert.equal(await store.deleteComment(a.id, "u3"), false, "someone else can't");
  assert.equal(await store.deleteComment(a.id, "u2"), true, "its author can");
  assert.equal(await store.deleteComment(b.id, "u1"), true, "the post's author can");
  assert.equal(await store.deleteComment(b.id, "u1"), false, "already gone");
  assert.equal((await store.getPost(post.id))!.comments, 0);
});

test("search finds posts by text, #tag and author, and users by handle", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  const store = createMemoryStore();
  await store.createPost({ userId: "u2", text: "Fresh drop #ZaprArt today", tags: ["#zaprart"] });

  const byTag = await store.search("#zaprart", 30);
  assert.ok(byTag.posts.some((p) => p.text.includes("Fresh drop")));
  const byWord = await store.search("fresh drop", 30);
  assert.ok(byWord.posts.some((p) => p.text.includes("Fresh drop")));
  const byUser = await store.search("@crypto", 30);
  assert.deepEqual(byUser.users.map((u) => u.handle), ["crypto_lea"]);
  assert.ok(byUser.posts.every((p) => p.author.handle === "crypto_lea"));
  assert.deepEqual(await store.search("   ", 30), { posts: [], users: [] });
});

test("profile pictures are saved and show up on the user's posts", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  const store = createMemoryStore();
  await store.updateUser("u4", { avatarUrl: IRYS });
  assert.equal((await store.getUserById("u4"))!.avatarUrl, IRYS);
  const posts = await store.listPosts({ limit: 100, authorId: "u4" });
  assert.ok(posts.length > 0 && posts.every((p) => p.author.avatarUrl === IRYS));
  await store.updateUser("u4", { avatarUrl: null });
  assert.equal((await store.getUserById("u4"))!.avatarUrl, null);
});
