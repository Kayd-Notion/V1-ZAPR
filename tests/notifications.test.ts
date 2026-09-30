// Notifications: derived from post zaps, creator zaps, follows and comments.
// Runs the demo (file) store on the seed data, in a throwaway data directory.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.ZAPR_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "zapr-notifs-"));

test("notifications: what others did to me, newest first, never my own actions", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  const store = createMemoryStore();
  const me = "u1"; // satoshi_fan, author of the live post p4
  const x = await store.createUser({ handle: "xavier", wallet: "Xav1111111111111111111111111111111111111111" });

  const t0 = Date.now();
  await store.setNotificationsSeenAt(me, t0 - 1);
  assert.equal(await store.countNotificationsSince(me, t0 - 1), 0);

  await store.follow(x.id, me);
  await store.addComment({ postId: "p4", userId: x.id, text: "nice one" });
  await store.recordPump({
    postId: "p4", pumperUserId: x.id, amount: 0.1, creatorAmount: 0.07, founderAmount: 0.03,
    signature: "notif-zap", anonymous: false,
  });
  await store.recordCreatorZap({
    creatorUserId: me, zapperUserId: x.id, amount: 0.5, creatorAmount: 0.45, founderAmount: 0.05,
    signature: "notif-czap", anonymous: true,
  });
  // My own actions are not notified.
  await store.addComment({ postId: "p4", userId: me, text: "thanks" });
  await store.recordPump({
    postId: "p4", pumperUserId: me, amount: 0.1, creatorAmount: 0.07, founderAmount: 0.03,
    signature: "notif-self", anonymous: false,
  });

  const seenAt = await store.getNotificationsSeenAt(me);
  assert.equal(await store.countNotificationsSince(me, seenAt), 4);

  const list = await store.listNotifications(me, { limit: 100 });
  const fresh = list.filter((n) => n.createdAt >= t0);
  assert.deepEqual(fresh.map((n) => n.kind).sort(), ["comment", "creator_zap", "follow", "post_zap"]);
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].createdAt >= list[i].createdAt, "newest first");

  const byKind = Object.fromEntries(fresh.map((n) => [n.kind, n]));
  assert.equal(byKind.follow.actor?.handle, "xavier");
  assert.equal(byKind.comment.text, "nice one");
  assert.equal(byKind.comment.postId, "p4");
  assert.equal(byKind.post_zap.amount, 0.07, "creator share");
  assert.equal(byKind.post_zap.postId, "p4");
  assert.ok(byKind.post_zap.postText);
  assert.equal(byKind.creator_zap.actor, null, "anonymous zap hides the zapper");
  assert.equal(byKind.creator_zap.amount, 0.45);

  // Nothing for the actor about their own actions.
  assert.equal((await store.listNotifications(x.id, { limit: 100 })).length, 0);

  // Keyset pagination: pages are contiguous and never overlap.
  const p1 = await store.listNotifications(me, { limit: 2 });
  const last = p1[p1.length - 1];
  const p2 = await store.listNotifications(me, { limit: 2, before: { createdAt: last.createdAt, id: last.id } });
  assert.deepEqual([...p1, ...p2].map((n) => n.id), list.slice(0, 4).map((n) => n.id));

  // Opening the list marks everything seen; the seen date never goes back.
  await store.setNotificationsSeenAt(me, Date.now());
  await store.setNotificationsSeenAt(me, 1);
  assert.equal(await store.countNotificationsSince(me, await store.getNotificationsSeenAt(me)), 0);
});
