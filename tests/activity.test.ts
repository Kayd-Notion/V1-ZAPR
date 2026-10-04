// Wallet → Activity: zaps sent and creator shares received, with filters and pagination.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.ZAPR_DATA_DIR = mkdtempSync(path.join(os.tmpdir(), "zapr-activity-"));

test("activity lists what a user sent and received, newest first", async () => {
  const { createMemoryStore } = await import("../src/lib/db/memory");
  const store = createMemoryStore();
  // Fresh users so the seed's own history doesn't get in the way.
  const a = await store.createUser({ handle: "act_a", wallet: "WalletActA" });
  const b = await store.createUser({ handle: "act_b", wallet: "WalletActB" });
  const post = await store.createPost({ userId: b.id, text: "b's post" });
  const own = await store.createPost({ userId: a.id, text: "a's post" });

  await store.recordPump({ postId: post.id, pumperUserId: a.id, amount: 0.1, creatorAmount: 0.07, founderAmount: 0.03, signature: "act-1", anonymous: false });
  await new Promise((r) => setTimeout(r, 2));
  await store.recordPump({ postId: own.id, pumperUserId: b.id, amount: 0.2, creatorAmount: 0.14, founderAmount: 0.06, signature: "act-2", anonymous: true });
  await new Promise((r) => setTimeout(r, 2));
  await store.recordCreatorZap({ creatorUserId: a.id, zapperUserId: b.id, amount: 0.5, creatorAmount: 0.45, founderAmount: 0.05, signature: "act-3", anonymous: false });
  await new Promise((r) => setTimeout(r, 2));
  await store.recordPump({ postId: own.id, pumperUserId: a.id, amount: 0.01, creatorAmount: 0.007, founderAmount: 0.003, signature: "act-4", anonymous: false });

  const all = await store.listActivity(a.id, { limit: 50, filter: "all" });
  assert.deepEqual(
    all.map((x) => [x.kind, x.direction, x.amount, x.self]),
    [
      // The self-zap shows on both sides; same-time rows are ordered by id ("zs:" > "zr:").
      ["zap_sent", "out", 0.01, true],
      ["zap_received", "in", 0.007, true],
      ["creator_zap_received", "in", 0.45, false],
      ["zap_received", "in", 0.14, false],
      ["zap_sent", "out", 0.1, false],
    ],
  );
  const anon = all.find((x) => x.kind === "zap_received" && !x.self)!;
  assert.equal(anon.counterpart, null, "an anonymous zapper stays anonymous");
  assert.equal(anon.total, 0.2);
  assert.equal(all.find((x) => x.kind === "zap_sent" && !x.self)!.counterpart!.handle, "act_b");
  assert.equal(all.find((x) => x.kind === "creator_zap_received")!.counterpart!.handle, "act_b");

  const inbound = await store.listActivity(a.id, { limit: 50, filter: "in" });
  assert.ok(inbound.length === 3 && inbound.every((x) => x.direction === "in"));
  const outbound = await store.listActivity(a.id, { limit: 50, filter: "out" });
  assert.ok(outbound.length === 2 && outbound.every((x) => x.direction === "out"));

  // Keyset pagination continues the same order without repeats.
  const p1 = await store.listActivity(a.id, { limit: 2, filter: "all" });
  const last = p1[p1.length - 1];
  const p2 = await store.listActivity(a.id, { limit: 10, filter: "all", before: { createdAt: last.createdAt, id: last.id } });
  assert.deepEqual([...p1, ...p2].map((x) => x.id), all.map((x) => x.id));

  // b's side
  const bAll = await store.listActivity(b.id, { limit: 50, filter: "all" });
  assert.deepEqual(bAll.map((x) => x.kind).sort(), ["creator_zap_sent", "zap_received", "zap_sent"].sort());
});
