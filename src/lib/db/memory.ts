/**
 * File-backed in-memory store — the default when DATABASE_URL is unset.
 *
 * Persists a single JSON snapshot to `.data/db.json` so data survives dev-server
 * reloads. This is NOT for production (no concurrency guarantees); it exists so
 * the whole app runs and is testable locally without provisioning Postgres.
 */
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { buildSeed } from "./seed";
import { expiresAt } from "../lifespan";
import type {
  Comment,
  CommentWithAuthor,
  CreatorRankEntry,
  CreatorZap,
  LeaderboardCursor,
  PostRankEntry,
  FeedQuery,
  LeaderboardQuery,
  Notification,
  Post,
  PostWithAuthor,
  Pump,
  PumpWithAuthor,
  Store,
  User,
} from "./types";

interface Follow {
  followerId: string;
  followeeId: string;
  createdAt: number;
}

interface DbShape {
  users: User[];
  posts: Post[];
  comments: Comment[];
  pumps: Pump[];
  follows: Follow[];
  creatorZaps: CreatorZap[];
  /** userId → when they last opened their notifications (ms epoch). */
  notificationsSeenAt: Record<string, number>;
}

// On serverless/read-only filesystems (e.g. Vercel) `process.cwd()` isn't
// writable — fall back to the OS temp dir so previews don't crash on writes.
// Data there is ephemeral (per warm instance); use Postgres for durability.
function resolveDataDir(): string {
  if (process.env.ZAPR_DATA_DIR) return process.env.ZAPR_DATA_DIR;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), "zapr");
  }
  return path.join(process.cwd(), ".data");
}
const DATA_DIR = resolveDataDir();
const DATA_FILE = path.join(DATA_DIR, "db.json");

let db: DbShape | null = null;
let loading: Promise<DbShape> | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function load(): Promise<DbShape> {
  if (db) return db;
  if (loading) return loading;
  loading = (async () => {
    try {
      const raw = await fs.readFile(DATA_FILE, "utf8");
      db = JSON.parse(raw) as DbShape;
      // Snapshots written before follows / creator zaps existed.
      db.follows ??= [];
      db.creatorZaps ??= [];
      db.notificationsSeenAt ??= {};
      for (const u of db.users) u.zapped ??= 0;
      if (backfillPumpSnapshots(db)) await persistNow(db);
    } catch {
      db = { ...buildSeed(), follows: [], creatorZaps: [], notificationsSeenAt: {} };
      await persistNow(db); // best-effort; safe if the FS is read-only
    }
    return db;
  })();
  return loading;
}

/**
 * Pumps recorded before creator/country were stored on the pump row get them
 * filled from their post (when it still exists). Returns true if anything changed.
 */
function backfillPumpSnapshots(d: DbShape): boolean {
  let changed = false;
  for (const pm of d.pumps) {
    if (pm.creatorUserId && pm.postCountry) continue;
    const post = d.posts.find((p) => p.id === pm.postId);
    if (!post) continue;
    pm.creatorUserId = post.userId;
    pm.postCountry = post.country;
    changed = true;
  }
  return changed;
}

/** Order: total desc, then id asc (stable tie-break shared with the cursor). */
function byTotalThenId(a: { total: number; id: string }, b: { total: number; id: string }) {
  return b.total - a.total || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Keyset filter: keep rows strictly after the cursor in that order. */
function afterCursor(total: number, id: string, cursor?: LeaderboardCursor): boolean {
  if (!cursor) return true;
  const t = Number(cursor.total);
  return total < t || (total === t && id > cursor.id);
}

async function persistNow(snapshot: DbShape): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
  } catch {
    // Read-only filesystem (serverless): keep serving from the in-memory copy.
  }
}

function persist(): void {
  // Serialize writes to avoid interleaved file writes clobbering each other.
  writeChain = writeChain.then(() => (db ? persistNow(db) : Promise.resolve())).catch(() => {});
}

function authorOf(u: User) {
  return { id: u.id, handle: u.handle, wallet: u.wallet, bio: u.bio };
}

/** Everything that happened to `userId`, newest first (own actions left out). */
function notificationEvents(d: DbShape, userId: string, now: number): Notification[] {
  const actor = (id: string) => {
    const u = d.users.find((x) => x.id === id);
    return u ? { id: u.id, handle: u.handle } : null;
  };
  const livePost = (id: string) => d.posts.find((p) => p.id === id && isAlive(p, now)) ?? null;
  const out: Notification[] = [];
  for (const pm of d.pumps) {
    if (pm.creatorUserId !== userId || pm.pumperUserId === userId) continue;
    const post = livePost(pm.postId);
    out.push({
      id: `z:${pm.id}`, kind: "post_zap", createdAt: pm.createdAt,
      actor: pm.anonymous ? null : actor(pm.pumperUserId), amount: pm.creatorAmount,
      postId: post?.id ?? null, postText: post?.text ?? null, text: null,
    });
  }
  for (const z of d.creatorZaps) {
    if (z.creatorUserId !== userId) continue;
    out.push({
      id: `c:${z.id}`, kind: "creator_zap", createdAt: z.createdAt,
      actor: z.anonymous ? null : actor(z.zapperUserId), amount: z.creatorAmount,
      postId: null, postText: null, text: null,
    });
  }
  for (const f of d.follows) {
    if (f.followeeId !== userId) continue;
    out.push({
      id: `f:${f.followerId}`, kind: "follow", createdAt: f.createdAt,
      actor: actor(f.followerId), amount: null, postId: null, postText: null, text: null,
    });
  }
  for (const c of d.comments) {
    if (c.userId === userId) continue;
    const post = d.posts.find((p) => p.id === c.postId);
    if (!post || post.userId !== userId) continue;
    const live = isAlive(post, now);
    out.push({
      id: `m:${c.id}`, kind: "comment", createdAt: c.createdAt,
      actor: actor(c.userId), amount: null,
      postId: live ? post.id : null, postText: live ? post.text : null, text: c.text,
    });
  }
  return out.sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
}

/** Still alive at `now` (expired posts appear nowhere). */
function isAlive(p: Post, now: number = Date.now()): boolean {
  return expiresAt(p.createdAt, p.pumped) > now;
}

export function createMemoryStore(): Store {
  const findUser = (d: DbShape, id: string) => d.users.find((u) => u.id === id) || null;

  return {
    async getUserById(id) {
      const d = await load();
      return findUser(d, id);
    },
    async getUserByWallet(wallet) {
      const d = await load();
      return d.users.find((u) => u.wallet === wallet) || null;
    },
    async getUserByHandle(handle) {
      const d = await load();
      const h = handle.toLowerCase();
      return d.users.find((u) => u.handle.toLowerCase() === h) || null;
    },
    async createUser({ handle, wallet, bio = "", country = "FR" }) {
      const d = await load();
      const user: User = {
        id: randomUUID(),
        handle,
        wallet,
        bio: bio || "gm, new on ZAPR.",
        country,
        createdAt: Date.now(),
        received: 0,
        given: 0,
        zapped: 0,
        hidePumpHistory: false,
        anonymizePumps: false,
      };
      d.users.push(user);
      persist();
      return user;
    },
    async updateUser(id, patch) {
      const d = await load();
      const u = findUser(d, id);
      if (!u) throw new Error("user not found");
      Object.assign(u, patch);
      persist();
      return u;
    },

    async createPost({ userId, text, mediaUrl = null, mediaType = null, country = "FR", tags = [] }) {
      const d = await load();
      const post: Post = {
        id: randomUUID(),
        userId,
        text,
        mediaUrl,
        mediaType,
        createdAt: Date.now(),
        pumped: 0,
        comments: 0,
        country,
        tags,
      };
      d.posts.push(post);
      persist();
      return post;
    },
    async getPost(id, opts) {
      const d = await load();
      const p = d.posts.find((x) => x.id === id);
      if (!p || !isAlive(p, Date.now() - (opts?.graceMs ?? 0))) return null;
      const author = findUser(d, p.userId);
      if (!author) return null;
      return { ...p, author: authorOf(author) };
    },
    async listPosts(q: FeedQuery) {
      const d = await load();
      const now = Date.now();
      let list = d.posts.filter((p) => isAlive(p, now));
      if (q.authorId) list = list.filter((p) => p.userId === q.authorId);
      if (q.authorIds) list = list.filter((p) => q.authorIds!.includes(p.userId));
      if (q.before) list = list.filter((p) => p.createdAt < q.before!);
      list.sort((a, b) => b.createdAt - a.createdAt);
      list = list.slice(0, q.limit);
      return list
        .map((p) => {
          const author = findUser(d, p.userId);
          return author ? { ...p, author: authorOf(author) } : null;
        })
        .filter((x): x is PostWithAuthor => x !== null);
    },

    async recordPump({ postId, pumperUserId, amount, creatorAmount, founderAmount, signature, anonymous }) {
      const d = await load();
      const post = d.posts.find((p) => p.id === postId);
      if (!post) throw new Error("post not found");
      if (d.pumps.some((p) => p.signature === signature)) {
        throw new Error("duplicate signature");
      }
      const pump: Pump = {
        id: randomUUID(),
        postId,
        pumperUserId,
        amount,
        creatorAmount,
        founderAmount,
        signature,
        anonymous,
        createdAt: Date.now(),
        creatorUserId: post.userId,
        postCountry: post.country,
      };
      d.pumps.push(pump);
      // Aggregates: post total, creator received, pumper given.
      post.pumped += amount;
      const creator = findUser(d, post.userId);
      if (creator) creator.received += creatorAmount;
      const pumper = findUser(d, pumperUserId);
      if (pumper) pumper.given += amount;
      persist();
      return { pump, post: { ...post } };
    },
    async purgeExpired(before) {
      const d = await load();
      const dead = new Set(d.posts.filter((p) => !isAlive(p, before)).map((p) => p.id));
      if (dead.size === 0) return 0;
      // Posts and their comments go; the zap log stays (money that moved).
      d.posts = d.posts.filter((p) => !dead.has(p.id));
      d.comments = d.comments.filter((c) => !dead.has(c.postId));
      persist();
      return dead.size;
    },
    async getPumpBySignature(signature) {
      const d = await load();
      return d.pumps.find((p) => p.signature === signature) || null;
    },
    async listPumpers(postId) {
      const d = await load();
      return d.pumps
        .filter((p) => p.postId === postId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((p) => {
          const author = findUser(d, p.pumperUserId);
          return author
            ? { ...p, author: { id: author.id, handle: author.handle, wallet: author.wallet } }
            : null;
        })
        .filter((x): x is PumpWithAuthor => x !== null);
    },

    async addComment({ postId, userId, text }) {
      const d = await load();
      const post = d.posts.find((p) => p.id === postId);
      if (!post) throw new Error("post not found");
      const comment: Comment = {
        id: randomUUID(),
        postId,
        userId,
        text,
        createdAt: Date.now(),
      };
      d.comments.push(comment);
      post.comments += 1;
      persist();
      return comment;
    },
    async listComments(postId) {
      const d = await load();
      return d.comments
        .filter((c) => c.postId === postId)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((c) => {
          const author = findUser(d, c.userId);
          return author
            ? { ...c, author: { id: author.id, handle: author.handle, wallet: author.wallet } }
            : null;
        })
        .filter((x): x is CommentWithAuthor => x !== null);
    },

    async follow(followerId, followeeId) {
      const d = await load();
      if (d.follows.some((f) => f.followerId === followerId && f.followeeId === followeeId)) return;
      d.follows.push({ followerId, followeeId, createdAt: Date.now() });
      persist();
    },
    async unfollow(followerId, followeeId) {
      const d = await load();
      d.follows = d.follows.filter((f) => !(f.followerId === followerId && f.followeeId === followeeId));
      persist();
    },
    async followStats(userId, viewerId) {
      const d = await load();
      return {
        followers: d.follows.filter((f) => f.followeeId === userId).length,
        following: d.follows.filter((f) => f.followerId === userId).length,
        isFollowing: Boolean(viewerId && d.follows.some((f) => f.followerId === viewerId && f.followeeId === userId)),
      };
    },
    async listFollowingIds(userId) {
      const d = await load();
      return d.follows.filter((f) => f.followerId === userId).map((f) => f.followeeId);
    },

    async recordCreatorZap({ creatorUserId, zapperUserId, amount, creatorAmount, founderAmount, signature, anonymous }) {
      const d = await load();
      if (d.creatorZaps.some((z) => z.signature === signature)) throw new Error("duplicate signature");
      const zap: CreatorZap = {
        id: randomUUID(),
        creatorUserId,
        zapperUserId,
        amount,
        creatorAmount,
        founderAmount,
        signature,
        anonymous,
        createdAt: Date.now(),
      };
      d.creatorZaps.push(zap);
      const creator = findUser(d, creatorUserId);
      if (creator) creator.zapped += amount;
      const zapper = findUser(d, zapperUserId);
      if (zapper) zapper.given += amount;
      persist();
      return zap;
    },
    async getCreatorZapBySignature(signature) {
      const d = await load();
      return d.creatorZaps.find((z) => z.signature === signature) || null;
    },

    async listNotifications(userId, { limit, before }) {
      const d = await load();
      return notificationEvents(d, userId, Date.now())
        .filter((n) => !before || n.createdAt < before.createdAt || (n.createdAt === before.createdAt && n.id < before.id))
        .slice(0, limit);
    },
    async countNotificationsSince(userId, after) {
      const d = await load();
      return Math.min(100, notificationEvents(d, userId, Date.now()).filter((n) => n.createdAt > after).length);
    },
    async getNotificationsSeenAt(userId) {
      const d = await load();
      return d.notificationsSeenAt[userId] ?? 0;
    },
    async setNotificationsSeenAt(userId, at) {
      const d = await load();
      d.notificationsSeenAt[userId] = Math.max(d.notificationsSeenAt[userId] ?? 0, at);
      persist();
    },

    async leaderboardPosts(q: LeaderboardQuery) {
      const d = await load();
      const byCountry = q.scope === "country" && q.country ? q.country : null;
      let rows: { id: string; total: number; creatorUserId: string | null }[];

      const now = Date.now();
      const alive = new Set(d.posts.filter((p) => isAlive(p, now)).map((p) => p.id));
      if (q.since === undefined) {
        // All time: cumulative total kept on the post.
        rows = d.posts
          .filter((p) => alive.has(p.id))
          .filter((p) => !byCountry || p.country === byCountry)
          .map((p) => ({ id: p.id, total: p.pumped, creatorUserId: p.userId }));
      } else {
        // Period: sum the per-pump log over the window, live posts only.
        const sums = new Map<string, { total: number; creatorUserId: string | null }>();
        for (const pm of d.pumps) {
          if (pm.createdAt < q.since || !alive.has(pm.postId)) continue;
          if (byCountry && pm.postCountry !== byCountry) continue;
          const cur = sums.get(pm.postId) ?? { total: 0, creatorUserId: pm.creatorUserId ?? null };
          cur.total += pm.amount;
          sums.set(pm.postId, cur);
        }
        rows = [...sums].map(([id, v]) => ({ id, ...v }));
      }

      rows = rows
        .filter((r) => afterCursor(r.total, r.id, q.cursor))
        .sort(byTotalThenId)
        .slice(0, q.limit);

      return rows.map((r): PostRankEntry => {
        const post = d.posts.find((p) => p.id === r.id);
        const author = post ? findUser(d, post.userId) : null;
        const creator = findUser(d, post?.userId ?? r.creatorUserId ?? "");
        return {
          postId: r.id,
          total: r.total,
          cursorTotal: String(r.total),
          post: post && author ? { ...post, author: authorOf(author) } : null,
          creator: creator ? { id: creator.id, handle: creator.handle, wallet: creator.wallet } : null,
        };
      });
    },
    async leaderboardCreators(q: LeaderboardQuery) {
      // Most zapped creators: share of the zaps on their posts + share of the
      // zaps sent to them directly. All time: post-zap running total plus the
      // direct-zap log; a period sums both logs over the window.
      const d = await load();
      const byCountry = q.scope === "country" && q.country ? q.country : null;
      const sums = new Map<string, number>();
      const add = (id: string, sol: number) => sums.set(id, (sums.get(id) ?? 0) + sol);
      if (q.since === undefined) {
        for (const u of d.users) add(u.id, u.received);
        for (const z of d.creatorZaps) add(z.creatorUserId, z.creatorAmount);
      } else {
        for (const pm of d.pumps) if (pm.createdAt >= q.since && pm.creatorUserId) add(pm.creatorUserId, pm.creatorAmount);
        for (const z of d.creatorZaps) if (z.createdAt >= q.since) add(z.creatorUserId, z.creatorAmount);
      }
      const rows: { id: string; total: number; user: User }[] = [];
      for (const [id, raw] of sums) {
        const user = findUser(d, id);
        const total = Math.round(raw * 1e9) / 1e9; // lamport precision, no float noise
        if (user && total > 0) rows.push({ id, total, user });
      }
      return rows
        .filter((r) => !byCountry || r.user.country === byCountry)
        .filter((r) => afterCursor(r.total, r.id, q.cursor))
        .sort(byTotalThenId)
        .slice(0, q.limit)
        .map((r): CreatorRankEntry => ({ user: r.user, total: r.total, cursorTotal: String(r.total) }));
    },
  };
}
