/**
 * Postgres store (Supabase / Neon). Active when DATABASE_URL is set.
 * Uses postgres.js (no ORM). Aggregates (post.pumped, user.received/given) are
 * updated transactionally inside recordPump.
 */
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { databaseUrl } from "./url";
import { expiresAt } from "../lifespan";
import { WALLET_IN_USE } from "./types";
import type {
  AdminStats,
  Activity,
  ActivityKind,
  CommentWithAuthor,
  CreatorRankEntry,
  CreatorZap,
  DeletePostResult,
  FeedQuery,
  LeaderboardQuery,
  LinkedWallet,
  LinkWalletResult,
  Notification,
  NotificationKind,
  PostRankEntry,
  PostWithAuthor,
  Pump,
  PumpWithAuthor,
  ReportGroup,
  ReportReason,
  ReportTargetType,
  Store,
  User,
} from "./types";

type Sql = ReturnType<typeof postgres>;

let ready: Promise<Sql> | null = null;
function getSql(): Promise<Sql> {
  if (!ready) {
    const url = databaseUrl()!;
    const sql = postgres(url, {
      ssl: url.includes("sslmode=require") ? "require" : undefined,
      max: 5,
      // Managed Postgres pools (Neon "-pooler", Supabase pgbouncer) run in
      // transaction mode, which doesn't support named prepared statements.
      prepare: false,
      onnotice: () => {},
    });
    ready = applySchema(sql).then(
      () => sql,
      (err) => {
        ready = null; // retry on the next request
        throw err;
      },
    );
  }
  return ready;
}

/**
 * Create/upgrade the tables on first use, so a fresh database (e.g. Neon added
 * from the Vercel dashboard) works without running any command. schema.sql is
 * idempotent; the advisory lock stops concurrent cold starts from racing.
 */
async function applySchema(sql: Sql): Promise<void> {
  const schema = await readFile(path.join(process.cwd(), "src/db/schema.sql"), "utf8");
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(727001)`;
    await tx.unsafe(schema);
    // Posts created before the expires_at column: compute it once (the
    // lifespan tiers live in the app, not in SQL).
    const missing = await tx`select id, created_at, pumped from posts where expires_at is null`;
    for (const r of missing) {
      await tx`update posts set expires_at = ${expiresAt(Number(r.created_at), Number(r.pumped))} where id = ${r.id}`;
    }
    // Live posts follow the current lifespan rules (they may have changed
    // since the post was last zapped): the stored expiry always matches what
    // the UI computes from (created_at, pumped).
    const live = await tx`select id, created_at, pumped, expires_at from posts where expires_at > ${Date.now()}`;
    for (const r of live) {
      const e = expiresAt(Number(r.created_at), Number(r.pumped));
      if (Number(r.expires_at) !== e) await tx`update posts set expires_at = ${e} where id = ${r.id}`;
    }
  });
}

// Postgres.js returns loosely-typed rows; we map them explicitly below.
type Row = Record<string, any>;

function rowToUser(r: Row): User {
  return {
    id: r.id,
    handle: r.handle,
    wallet: r.wallet,
    bio: r.bio,
    country: r.country,
    createdAt: Number(r.created_at),
    received: Number(r.received),
    given: Number(r.given),
    zapped: Number(r.zapped ?? 0),
    hidePumpHistory: r.hide_pump_history,
    anonymizePumps: r.anonymize_pumps,
    avatarUrl: r.avatar_url ?? null,
    banned: r.banned ?? false,
  };
}

function rowToPostWithAuthor(r: Row): PostWithAuthor {
  return {
    id: r.id,
    userId: r.user_id,
    text: r.text,
    mediaUrl: r.media_url,
    mediaType: r.media_type,
    createdAt: Number(r.created_at),
    pumped: Number(r.pumped),
    comments: r.comments,
    country: r.country,
    tags: r.tags ?? [],
    author: {
      id: r.author_id,
      handle: r.author_handle,
      wallet: r.author_wallet,
      bio: r.author_bio,
      avatarUrl: r.author_avatar ?? null,
    },
  };
}

function rowToPump(r: Row): Pump {
  return {
    id: r.id,
    postId: r.post_id,
    pumperUserId: r.pumper_user_id,
    amount: Number(r.amount),
    creatorAmount: Number(r.creator_amount),
    founderAmount: Number(r.founder_amount),
    signature: r.signature,
    anonymous: r.anonymous,
    createdAt: Number(r.created_at),
    creatorUserId: r.creator_user_id,
    postCountry: r.post_country,
  };
}

function rowToCreatorZap(r: Row): CreatorZap {
  return {
    id: r.id,
    creatorUserId: r.creator_user_id,
    zapperUserId: r.zapper_user_id,
    amount: Number(r.amount),
    creatorAmount: Number(r.creator_amount),
    founderAmount: Number(r.founder_amount),
    signature: r.signature,
    anonymous: r.anonymous,
    createdAt: Number(r.created_at),
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DECIMAL_RE = /^-?\d+(\.\d+)?(e[-+]?\d+)?$/i;

/** A cursor we can't have issued (bad id/total) yields no rows rather than a SQL error. */
function cursorIsUsable(c: LeaderboardQuery["cursor"]): boolean {
  return !c || (UUID_RE.test(c.id) && DECIMAL_RE.test(c.total));
}

/** Row → posts-leaderboard entry. The post columns are null when it was removed. */
/**
 * Everything that happened to `userId`, as one row shape (kind, nid, created_at,
 * actor_id, anonymous, amount, post_id, body). Own actions are left out.
 */
function notificationEvents(db: Sql, userId: string) {
  return db`
    select 'post_zap' as kind, 'z:' || pm.id as nid, pm.created_at, pm.pumper_user_id as actor_id,
           pm.anonymous, pm.creator_amount as amount, pm.post_id, null::text as body
    from pumps pm
    where pm.creator_user_id = ${userId} and pm.pumper_user_id <> ${userId}
    union all
    select 'creator_zap', 'c:' || cz.id, cz.created_at, cz.zapper_user_id,
           cz.anonymous, cz.creator_amount, null::uuid, null::text
    from creator_zaps cz
    where cz.creator_user_id = ${userId}
    union all
    select 'follow', 'f:' || f.follower_id, f.created_at, f.follower_id,
           false, null::float8, null::uuid, null::text
    from follows f
    where f.followee_id = ${userId}
    union all
    select 'comment', 'm:' || c.id, c.created_at, c.user_id,
           false, null::float8, c.post_id, c.text
    from comments c join posts cp on cp.id = c.post_id
    where cp.user_id = ${userId} and c.user_id <> ${userId}`;
}

/**
 * The money history of `userId` as one row shape (kind, aid, created_at, dir,
 * amount, total, cp_id, cp_hidden, post_id, signature, self): zaps sent to
 * posts and creators, creator shares received from both.
 */
function activityEvents(db: Sql, userId: string) {
  return db`
    select 'zap_sent' as kind, 'zs:' || pm.id as aid, pm.created_at, 'out' as dir,
           pm.amount, pm.amount as total, pm.creator_user_id as cp_id, false as cp_hidden,
           pm.post_id, pm.signature, (pm.creator_user_id = ${userId}) as self
    from pumps pm where pm.pumper_user_id = ${userId}
    union all
    select 'creator_zap_sent', 'cs:' || cz.id, cz.created_at, 'out',
           cz.amount, cz.amount, cz.creator_user_id, false, null::uuid, cz.signature, false
    from creator_zaps cz where cz.zapper_user_id = ${userId}
    union all
    select 'zap_received', 'zr:' || pm.id, pm.created_at, 'in',
           pm.creator_amount, pm.amount, pm.pumper_user_id, (pm.anonymous and pm.pumper_user_id <> ${userId}),
           pm.post_id, pm.signature, (pm.pumper_user_id = ${userId})
    from pumps pm where pm.creator_user_id = ${userId}
    union all
    select 'creator_zap_received', 'cr:' || cz.id, cz.created_at, 'in',
           cz.creator_amount, cz.amount, cz.zapper_user_id, cz.anonymous, null::uuid, cz.signature, false
    from creator_zaps cz where cz.creator_user_id = ${userId}`;
}

function rowToPostRank(r: Row): PostRankEntry {
  return {
    postId: r.rank_post_id,
    total: Number(r.rank_total),
    cursorTotal: String(r.rank_total),
    post: r.id ? rowToPostWithAuthor(r) : null,
    creator: r.author_id
      ? { id: r.author_id, handle: r.author_handle, wallet: r.author_wallet, avatarUrl: r.author_avatar ?? null }
      : null,
  };
}

export function createPostgresStore(): Store {
  return {
    async getUserById(id) {
      const db = await getSql();
      const rows = await db`select * from users where id = ${id} limit 1`;
      return rows[0] ? rowToUser(rows[0]) : null;
    },
    async getUserByWallet(wallet) {
      const db = await getSql();
      const rows = await db`
        select * from users where wallet = ${wallet}
        union all
        select u.* from user_wallets w join users u on u.id = w.user_id where w.wallet = ${wallet}
        limit 1`;
      return rows[0] ? rowToUser(rows[0]) : null;
    },
    async getUserByHandle(handle) {
      const db = await getSql();
      const rows = await db`select * from users where lower(handle) = ${handle.toLowerCase()} limit 1`;
      return rows[0] ? rowToUser(rows[0]) : null;
    },
    async createUser({ handle, wallet, bio = "", country = "FR" }) {
      const db = await getSql();
      const id = randomUUID();
      return db.begin(async (tx) => {
        // Same lock as linkWallet: a wallet can't become an account and a
        // linked wallet of another account at the same time.
        await tx`select pg_advisory_xact_lock(727002, hashtext(${wallet}))`;
        const used = await tx`
          select 1 from users where wallet = ${wallet}
          union all
          select 1 from user_wallets where wallet = ${wallet}
          limit 1`;
        if (used[0]) throw new Error(WALLET_IN_USE);
        const rows = await tx`
          insert into users (id, handle, wallet, bio, country, created_at)
          values (${id}, ${handle}, ${wallet}, ${bio || "gm, new on ZAPR."}, ${country}, ${Date.now()})
          returning *`;
        return rowToUser(rows[0]);
      });
    },
    async updateUser(id, patch) {
      const db = await getSql();
      const rows = await db`
        update users set
          bio = coalesce(${patch.bio ?? null}, bio),
          handle = coalesce(${patch.handle ?? null}, handle),
          hide_pump_history = coalesce(${patch.hidePumpHistory ?? null}, hide_pump_history),
          anonymize_pumps = coalesce(${patch.anonymizePumps ?? null}, anonymize_pumps),
          avatar_url = ${"avatarUrl" in patch ? db`${patch.avatarUrl ?? null}` : db`avatar_url`}
        where id = ${id}
        returning *`;
      if (!rows[0]) throw new Error("user not found");
      return rowToUser(rows[0]);
    },

    async listLinkedWallets(userId) {
      const db = await getSql();
      const rows = await db`
        select wallet, label, created_at from user_wallets where user_id = ${userId} order by created_at, wallet`;
      return rows.map((r): LinkedWallet => ({ wallet: r.wallet, label: r.label, createdAt: Number(r.created_at) }));
    },
    async linkWallet({ userId, wallet, label }, max) {
      const db = await getSql();
      return db.begin(async (tx): Promise<LinkWalletResult> => {
        // One link at a time per wallet (two accounts racing for the same one).
        await tx`select pg_advisory_xact_lock(727002, hashtext(${wallet}))`;
        const owner = await tx`
          select id from users where wallet = ${wallet}
          union all
          select user_id as id from user_wallets where wallet = ${wallet}
          limit 1`;
        if (owner[0]) return owner[0].id === userId ? "already" : "taken";
        const [{ n }] = await tx`select count(*)::int as n from user_wallets where user_id = ${userId}`;
        if (n >= max) return "limit";
        await tx`
          insert into user_wallets (wallet, user_id, label, created_at)
          values (${wallet}, ${userId}, ${label}, ${Date.now()})`;
        return "linked";
      });
    },
    async unlinkWallet(userId, wallet) {
      const db = await getSql();
      const rows = await db`delete from user_wallets where user_id = ${userId} and wallet = ${wallet} returning wallet`;
      return rows.length > 0;
    },

    async createPost({ userId, text, mediaUrl = null, mediaType = null, country = "FR", tags = [] }) {
      const db = await getSql();
      const id = randomUUID();
      const now = Date.now();
      const rows = await db`
        insert into posts (id, user_id, text, media_url, media_type, created_at, expires_at, country, tags)
        values (${id}, ${userId}, ${text}, ${mediaUrl}, ${mediaType}, ${now}, ${expiresAt(now, 0)}, ${country}, ${db.array(tags)})
        returning *`;
      const r = rows[0];
      return {
        id: r.id,
        userId: r.user_id,
        text: r.text,
        mediaUrl: r.media_url,
        mediaType: r.media_type,
        createdAt: Number(r.created_at),
        pumped: Number(r.pumped),
        comments: r.comments,
        country: r.country,
        tags: r.tags ?? [],
      };
    },
    async getPost(id, opts) {
      const db = await getSql();
      if (!UUID_RE.test(id)) return null;
      const aliveAfter = Date.now() - (opts?.graceMs ?? 0);
      const rows = await db`
        select p.*, u.id as author_id, u.handle as author_handle, u.wallet as author_wallet, u.bio as author_bio, u.avatar_url as author_avatar
        from posts p join users u on u.id = p.user_id
        where p.id = ${id} and p.expires_at > ${aliveAfter}
          ${opts?.includeHidden ? db`` : db`and not p.hidden and not u.banned`}
        limit 1`;
      return rows[0] ? rowToPostWithAuthor(rows[0]) : null;
    },
    async listPosts(q: FeedQuery) {
      const db = await getSql();
      const rows = await db`
        select p.*, u.id as author_id, u.handle as author_handle, u.wallet as author_wallet, u.bio as author_bio, u.avatar_url as author_avatar
        from posts p join users u on u.id = p.user_id
        where p.expires_at > ${Date.now()} and not p.hidden and not u.banned
          ${q.authorId ? db`and p.user_id = ${q.authorId}` : db``}
          ${q.authorIds ? db`and p.user_id = any(${db.array(q.authorIds)}::uuid[])` : db``}
          ${q.before ? db`and p.created_at < ${q.before}` : db``}
        order by p.created_at desc
        limit ${q.limit}`;
      return rows.map(rowToPostWithAuthor);
    },

    async recordPump({ postId, pumperUserId, amount, creatorAmount, founderAmount, signature, anonymous }) {
      const db = await getSql();
      return db.begin(async (tx) => {
        const postRows = await tx`
          update posts set pumped = pumped + ${amount} where id = ${postId} returning *`;
        if (!postRows[0]) throw new Error("post not found");
        const newExpiry = expiresAt(Number(postRows[0].created_at), Number(postRows[0].pumped));
        await tx`update posts set expires_at = ${newExpiry} where id = ${postId}`;
        const id = randomUUID();
        const pumpRows = await tx`
          insert into pumps (id, post_id, pumper_user_id, amount, creator_amount, founder_amount,
                             signature, anonymous, created_at, creator_user_id, post_country)
          values (${id}, ${postId}, ${pumperUserId}, ${amount}, ${creatorAmount}, ${founderAmount},
                  ${signature}, ${anonymous}, ${Date.now()}, ${postRows[0].user_id}, ${postRows[0].country})
          returning *`;
        await tx`update users set received = received + ${creatorAmount} where id = ${postRows[0].user_id}`;
        await tx`update users set given = given + ${amount} where id = ${pumperUserId}`;
        const pump = rowToPump(pumpRows[0]);
        const p = postRows[0];
        return {
          pump,
          post: {
            id: p.id,
            userId: p.user_id,
            text: p.text,
            mediaUrl: p.media_url,
            mediaType: p.media_type,
            createdAt: Number(p.created_at),
            pumped: Number(p.pumped),
            comments: p.comments,
            country: p.country,
            tags: p.tags ?? [],
          },
        };
      });
    },
    async purgeExpired(before) {
      const db = await getSql();
      // Comments go with the post (ON DELETE CASCADE); the zap log stays.
      const rows = await db`delete from posts where expires_at <= ${before} returning id`;
      return rows.length;
    },
    async deletePost(postId, userId): Promise<DeletePostResult> {
      const db = await getSql();
      if (!UUID_RE.test(postId)) return "not_found";
      // One statement: the zap check and the delete can't be split by a zap.
      const rows = await db`
        delete from posts p
        where p.id = ${postId} and p.user_id = ${userId} and p.pumped = 0
          and not exists (select 1 from pumps pm where pm.post_id = p.id)
        returning p.id`;
      if (rows.length) return "deleted";
      const [p] = await db`select user_id from posts where id = ${postId} and expires_at > ${Date.now()}`;
      if (!p) return "not_found";
      return p.user_id === userId ? "has_zaps" : "not_author";
    },
    async search(query, limit) {
      const db = await getSql();
      const q = query.trim().toLowerCase();
      if (!q) return { posts: [], users: [] };
      // Literal match: % and _ typed by the user are not wildcards.
      const like = `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
      const tag = q.startsWith("#") ? q : `#${q}`;
      const handleLike = `%${q.replace(/^@/, "").replace(/[\\%_]/g, (c) => "\\" + c)}%`;
      const [posts, users] = await Promise.all([
        db`
          select p.*, u.id as author_id, u.handle as author_handle, u.wallet as author_wallet, u.bio as author_bio,
                 u.avatar_url as author_avatar
          from posts p join users u on u.id = p.user_id
          where p.expires_at > ${Date.now()} and not p.hidden and not u.banned
            and (p.text ilike ${like} or ${tag} = any(p.tags) or u.handle ilike ${handleLike})
          order by p.pumped desc, p.created_at desc
          limit ${limit}`,
        db`
          select * from users
          where handle ilike ${handleLike} and not banned
          order by received desc, handle asc
          limit ${Math.min(limit, 10)}`,
      ]);
      return { posts: posts.map(rowToPostWithAuthor), users: users.map(rowToUser) };
    },
    async getPumpBySignature(signature) {
      const db = await getSql();
      const rows = await db`select * from pumps where signature = ${signature} limit 1`;
      return rows[0] ? rowToPump(rows[0]) : null;
    },
    async listPumpers(postId) {
      const db = await getSql();
      const rows = await db`
        select pm.*, u.id as author_id, u.handle as author_handle, u.wallet as author_wallet, u.avatar_url as author_avatar
        from pumps pm join users u on u.id = pm.pumper_user_id
        where pm.post_id = ${postId}
        order by pm.created_at desc`;
      return rows.map(
        (r): PumpWithAuthor => ({
          ...rowToPump(r),
          author: { id: r.author_id, handle: r.author_handle, wallet: r.author_wallet, avatarUrl: r.author_avatar ?? null },
        }),
      );
    },

    async addComment({ postId, userId, text }) {
      const db = await getSql();
      const id = randomUUID();
      const rows = await db.begin(async (tx) => {
        const c = await tx`
          insert into comments (id, post_id, user_id, text, created_at)
          values (${id}, ${postId}, ${userId}, ${text}, ${Date.now()})
          returning *`;
        await tx`update posts set comments = comments + 1 where id = ${postId}`;
        return c;
      });
      const r = rows[0];
      return {
        id: r.id,
        postId: r.post_id,
        userId: r.user_id,
        text: r.text,
        createdAt: Number(r.created_at),
      };
    },
    async listComments(postId) {
      const db = await getSql();
      const rows = await db`
        select c.*, u.id as author_id, u.handle as author_handle, u.wallet as author_wallet, u.avatar_url as author_avatar
        from comments c join users u on u.id = c.user_id
        where c.post_id = ${postId} and not u.banned
        order by c.created_at desc`;
      return rows.map(
        (r): CommentWithAuthor => ({
          id: r.id,
          postId: r.post_id,
          userId: r.user_id,
          text: r.text,
          createdAt: Number(r.created_at),
          author: { id: r.author_id, handle: r.author_handle, wallet: r.author_wallet, avatarUrl: r.author_avatar ?? null },
        }),
      );
    },

    async deleteComment(commentId, userId) {
      const db = await getSql();
      if (!UUID_RE.test(commentId)) return false;
      return db.begin(async (tx) => {
        const rows = await tx`
          delete from comments c
          using posts p
          where c.id = ${commentId} and p.id = c.post_id and (c.user_id = ${userId} or p.user_id = ${userId})
          returning c.post_id`;
        if (!rows[0]) return false;
        await tx`update posts set comments = greatest(comments - 1, 0) where id = ${rows[0].post_id}`;
        return true;
      });
    },

    async follow(followerId, followeeId) {
      const db = await getSql();
      await db`
        insert into follows (follower_id, followee_id, created_at)
        values (${followerId}, ${followeeId}, ${Date.now()})
        on conflict do nothing`;
    },
    async unfollow(followerId, followeeId) {
      const db = await getSql();
      await db`delete from follows where follower_id = ${followerId} and followee_id = ${followeeId}`;
    },
    async followStats(userId, viewerId) {
      const db = await getSql();
      const [r] = await db`
        select
          (select count(*) from follows where followee_id = ${userId})::int as followers,
          (select count(*) from follows where follower_id = ${userId})::int as following,
          ${viewerId ? db`exists(select 1 from follows where follower_id = ${viewerId} and followee_id = ${userId})` : db`false`} as is_following`;
      return { followers: r.followers, following: r.following, isFollowing: r.is_following };
    },
    async listFollowingIds(userId) {
      const db = await getSql();
      const rows = await db`select followee_id from follows where follower_id = ${userId}`;
      return rows.map((r) => r.followee_id as string);
    },

    async recordCreatorZap({ creatorUserId, zapperUserId, amount, creatorAmount, founderAmount, signature, anonymous }) {
      const db = await getSql();
      return db.begin(async (tx) => {
        const rows = await tx`
          insert into creator_zaps (id, creator_user_id, zapper_user_id, amount, creator_amount, founder_amount,
                                    signature, anonymous, created_at)
          values (${randomUUID()}, ${creatorUserId}, ${zapperUserId}, ${amount}, ${creatorAmount}, ${founderAmount},
                  ${signature}, ${anonymous}, ${Date.now()})
          returning *`;
        await tx`update users set zapped = zapped + ${amount} where id = ${creatorUserId}`;
        await tx`update users set given = given + ${amount} where id = ${zapperUserId}`;
        return rowToCreatorZap(rows[0]);
      });
    },
    async getCreatorZapBySignature(signature) {
      const db = await getSql();
      const rows = await db`select * from creator_zaps where signature = ${signature} limit 1`;
      return rows[0] ? rowToCreatorZap(rows[0]) : null;
    },

    async listNotifications(userId, { limit, before }) {
      const db = await getSql();
      const now = Date.now();
      const rows = await db`
        select n.*, u.handle as actor_handle, u.avatar_url as actor_avatar, p.text as post_text
        from (${notificationEvents(db, userId)}) n
        left join users u on u.id = n.actor_id and not n.anonymous
        left join posts p on p.id = n.post_id and p.expires_at > ${now}
        where true
          ${before ? db`and (n.created_at < ${before.createdAt} or (n.created_at = ${before.createdAt} and n.nid < ${before.id}))` : db``}
        order by n.created_at desc, n.nid desc
        limit ${limit}`;
      return rows.map(
        (r): Notification => ({
          id: r.nid,
          kind: r.kind as NotificationKind,
          createdAt: Number(r.created_at),
          actor: r.actor_handle ? { id: r.actor_id, handle: r.actor_handle, avatarUrl: r.actor_avatar ?? null } : null,
          amount: r.amount === null ? null : Number(r.amount),
          postId: r.post_text === null ? null : r.post_id,
          postText: r.post_text ?? null,
          text: r.body ?? null,
        }),
      );
    },
    async countNotificationsSince(userId, after) {
      const db = await getSql();
      const [r] = await db`
        select count(*)::int as n from (
          select 1 from (${notificationEvents(db, userId)}) e where e.created_at > ${after} limit 100
        ) x`;
      return r.n;
    },
    async listActivity(userId, { limit, filter, before }) {
      const db = await getSql();
      const rows = await db`
        select e.*, u.handle as cp_handle, u.avatar_url as cp_avatar, p.text as post_text
        from (${activityEvents(db, userId)}) e
        left join users u on u.id = e.cp_id and not e.cp_hidden
        left join posts p on p.id = e.post_id and p.expires_at > ${Date.now()}
        where true
          ${filter === "all" ? db`` : db`and e.dir = ${filter}`}
          ${before ? db`and (e.created_at < ${before.createdAt} or (e.created_at = ${before.createdAt} and e.aid < ${before.id}))` : db``}
        order by e.created_at desc, e.aid desc
        limit ${limit}`;
      return rows.map(
        (r): Activity => ({
          id: r.aid,
          kind: r.kind as ActivityKind,
          direction: r.dir,
          createdAt: Number(r.created_at),
          amount: Number(r.amount),
          total: Number(r.total),
          counterpart: r.cp_handle ? { id: r.cp_id, handle: r.cp_handle, avatarUrl: r.cp_avatar ?? null } : null,
          postId: r.post_text === null ? null : r.post_id,
          postText: r.post_text ?? null,
          self: r.self,
          signature: r.signature,
        }),
      );
    },
    async hitRateLimit(key, windowMs) {
      const db = await getSql();
      const now = Date.now();
      const windowStart = now - (now % windowMs);
      const [r] = await db`
        insert into rate_limits (key, window_start, count) values (${key}, ${windowStart}, 1)
        on conflict (key) do update set
          count = case when rate_limits.window_start = excluded.window_start then rate_limits.count + 1 else 1 end,
          window_start = excluded.window_start
        returning count`;
      // Now and then, drop counters nobody has touched for a day.
      if (Math.random() < 0.01) await db`delete from rate_limits where window_start < ${now - 86_400_000}`;
      return r.count;
    },
    async createReport({ reporterId, targetType, targetId, reason, details }) {
      const db = await getSql();
      if (!UUID_RE.test(targetId)) return "not_found";
      const exists =
        targetType === "post"
          ? await db`select 1 from posts where id = ${targetId} and expires_at > ${Date.now()}`
          : await db`select 1 from comments where id = ${targetId}`;
      if (!exists.length) return "not_found";
      const rows = await db`
        insert into reports (id, target_type, target_id, reporter_id, reason, details, created_at)
        values (${randomUUID()}, ${targetType}, ${targetId}, ${reporterId}, ${reason}, ${details}, ${Date.now()})
        on conflict (target_type, target_id, reporter_id) do nothing
        returning id`;
      return rows.length ? "created" : "duplicate";
    },
    async listOpenReports(limit) {
      const db = await getSql();
      const groups = await db`
        select target_type, target_id, count(*)::int as n,
               array_agg(distinct reason) as reasons,
               array_remove(array_agg(nullif(details, '')), null) as details,
               min(created_at) as first_at, max(created_at) as last_at
        from reports where status = 'open'
        group by target_type, target_id
        order by n desc, last_at desc
        limit ${limit}`;
      const ids = (t: ReportTargetType) => groups.filter((g) => g.target_type === t).map((g) => g.target_id as string);
      const postIds = ids("post");
      const commentIds = ids("comment");
      const posts = postIds.length
        ? await db`
            select p.id, p.text, p.media_url, p.hidden, u.id as uid, u.handle, u.avatar_url, u.banned
            from posts p join users u on u.id = p.user_id where p.id = any(${db.array(postIds)}::uuid[])`
        : [];
      const comments = commentIds.length
        ? await db`
            select c.id, c.text, c.post_id, u.id as uid, u.handle, u.avatar_url, u.banned
            from comments c join users u on u.id = c.user_id where c.id = any(${db.array(commentIds)}::uuid[])`
        : [];
      return groups.map((g): ReportGroup => {
        const t = (g.target_type === "post" ? posts : comments).find((x) => x.id === g.target_id);
        return {
          targetType: g.target_type,
          targetId: g.target_id,
          count: g.n,
          reasons: g.reasons as ReportReason[],
          details: g.details ?? [],
          firstAt: Number(g.first_at),
          lastAt: Number(g.last_at),
          text: t?.text ?? null,
          mediaUrl: t?.media_url ?? null,
          postId: t ? (g.target_type === "post" ? t.id : t.post_id) : null,
          author: t ? { id: t.uid, handle: t.handle, avatarUrl: t.avatar_url ?? null, banned: t.banned } : null,
          hidden: Boolean(t?.hidden),
        };
      });
    },
    async resolveReports(targetType, targetId, status) {
      const db = await getSql();
      if (!UUID_RE.test(targetId)) return 0;
      const rows = await db`
        update reports set status = ${status}, resolved_at = ${Date.now()}
        where target_type = ${targetType} and target_id = ${targetId} and status = 'open'
        returning id`;
      return rows.length;
    },
    async setPostHidden(postId, hidden) {
      const db = await getSql();
      if (!UUID_RE.test(postId)) return false;
      const rows = await db`update posts set hidden = ${hidden} where id = ${postId} returning id`;
      return rows.length > 0;
    },
    async setUserBanned(userId, banned) {
      const db = await getSql();
      if (!UUID_RE.test(userId)) return false;
      const rows = await db`update users set banned = ${banned} where id = ${userId} returning id`;
      return rows.length > 0;
    },
    async removeComment(commentId) {
      const db = await getSql();
      if (!UUID_RE.test(commentId)) return false;
      return db.begin(async (tx) => {
        const rows = await tx`delete from comments where id = ${commentId} returning post_id`;
        if (!rows[0]) return false;
        await tx`update posts set comments = greatest(comments - 1, 0) where id = ${rows[0].post_id}`;
        return true;
      });
    },
    async listHiddenPosts(limit) {
      const db = await getSql();
      const rows = await db`
        select p.*, u.id as author_id, u.handle as author_handle, u.wallet as author_wallet, u.bio as author_bio,
               u.avatar_url as author_avatar
        from posts p join users u on u.id = p.user_id
        where p.hidden and p.expires_at > ${Date.now()}
        order by p.created_at desc
        limit ${limit}`;
      return rows.map(rowToPostWithAuthor);
    },
    async listBannedUsers(limit) {
      const db = await getSql();
      const rows = await db`select * from users where banned order by handle limit ${limit}`;
      return rows.map(rowToUser);
    },
    async adminStats(): Promise<AdminStats> {
      const db = await getSql();
      const now = Date.now();
      const day = now - 24 * 3600_000;
      const [r] = await db`
        select
          (select count(*) from users)::int as users,
          (select count(*) from users where banned)::int as banned_users,
          (select count(*) from users where created_at >= ${day})::int as new_users_24h,
          (select count(*) from posts where expires_at > ${now} and not hidden)::int as live_posts,
          (select count(*) from posts where expires_at > ${now} and hidden)::int as hidden_posts,
          (select count(*) from pumps)::int + (select count(*) from creator_zaps)::int as zaps,
          coalesce((select sum(amount::numeric) from pumps), 0) + coalesce((select sum(amount::numeric) from creator_zaps), 0) as sol,
          coalesce((select sum(founder_amount::numeric) from pumps), 0)
            + coalesce((select sum(founder_amount::numeric) from creator_zaps), 0) as revenue,
          (select count(*) from pumps where created_at >= ${day})::int
            + (select count(*) from creator_zaps where created_at >= ${day})::int as zaps_24h,
          coalesce((select sum(amount::numeric) from pumps where created_at >= ${day}), 0)
            + coalesce((select sum(amount::numeric) from creator_zaps where created_at >= ${day}), 0) as sol_24h,
          (select count(distinct (target_type, target_id)) from reports where status = 'open')::int as open_reports,
          (select count(*) from pumps where pumper_user_id = creator_user_id)::int
            + (select count(*) from creator_zaps where zapper_user_id = creator_user_id)::int as self_zaps,
          (select count(*) from pumps where creator_user_id is null)::int as unattributed_zaps,
          (select count(*) from posts p
             where p.expires_at > ${now}
               and abs(p.pumped::numeric - coalesce((select sum(pm.amount::numeric) from pumps pm where pm.post_id = p.id), 0)) > 0.000001
          )::int as posts_out_of_sync`;
      return {
        users: r.users,
        bannedUsers: r.banned_users,
        livePosts: r.live_posts,
        hiddenPosts: r.hidden_posts,
        zaps: r.zaps,
        solZapped: Number(r.sol),
        platformRevenue: Number(r.revenue),
        zaps24h: r.zaps_24h,
        solZapped24h: Number(r.sol_24h),
        newUsers24h: r.new_users_24h,
        openReports: r.open_reports,
        selfZaps: r.self_zaps,
        unattributedZaps: r.unattributed_zaps,
        postsOutOfSync: r.posts_out_of_sync,
      };
    },

    async getNotificationsSeenAt(userId) {
      const db = await getSql();
      const rows = await db`select notifications_seen_at from users where id = ${userId}`;
      return rows[0] ? Number(rows[0].notifications_seen_at) : 0;
    },
    async setNotificationsSeenAt(userId, at) {
      const db = await getSql();
      await db`update users set notifications_seen_at = greatest(notifications_seen_at, ${at}) where id = ${userId}`;
    },

    async leaderboardPosts(q: LeaderboardQuery) {
      // Most zapped live posts: the full amount of every zap (100 %), summed
      // from the zap log over the window (all time = since 0). Zaps by the
      // post's own author (any of their wallets: zaps are recorded per
      // account) don't count (lib/ranking.ts). Sums use numeric so totals are
      // exact and identical across pages (stable keyset).
      const db = await getSql();
      if (!cursorIsUsable(q.cursor)) return [];
      const country = q.scope === "country" && q.country ? q.country : null;
      const c = q.cursor;
      const rows = await db`
        with agg as (
          select pm.post_id, sum(pm.amount::numeric) as total
          from pumps pm
          join posts p on p.id = pm.post_id
          where pm.created_at >= ${q.since ?? 0}
            and pm.pumper_user_id <> p.user_id
            and p.expires_at > ${Date.now()} and not p.hidden
            ${country ? db`and p.country = ${country}` : db``}
          group by pm.post_id
        )
        select p.*, agg.post_id as rank_post_id, agg.total::text as rank_total,
               u.id as author_id, u.handle as author_handle, u.wallet as author_wallet, u.bio as author_bio, u.avatar_url as author_avatar
        from agg
        join posts p on p.id = agg.post_id
        join users u on u.id = p.user_id
        where not u.banned
          ${c ? db`and (agg.total < ${c.total}::numeric or (agg.total = ${c.total}::numeric and agg.post_id > ${c.id}::uuid))` : db``}
        order by agg.total desc, agg.post_id asc
        limit ${q.limit}`;
      return rows.map(rowToPostRank);
    },
    async leaderboardCreators(q: LeaderboardQuery) {
      // Most zapped creators: the full amount (100 %) of the zaps on their
      // posts plus the zaps sent to them directly, from both logs over the
      // window (all time = since 0). Zaps to yourself don't count. Creators
      // who received nothing are left out.
      const db = await getSql();
      if (!cursorIsUsable(q.cursor)) return [];
      const country = q.scope === "country" && q.country ? q.country : null;
      const c = q.cursor;
      const since = q.since ?? 0;
      const rows = await db`
        select u.*, agg.total::text as rank_total
        from (
          select creator_user_id, sum(amount) as total
          from (
            select pm.creator_user_id, pm.amount::numeric as amount
            from pumps pm
            where pm.created_at >= ${since} and pm.creator_user_id is not null
              and pm.pumper_user_id <> pm.creator_user_id
            union all
            select cz.creator_user_id, cz.amount::numeric
            from creator_zaps cz
            where cz.created_at >= ${since} and cz.zapper_user_id <> cz.creator_user_id
          ) zaps
          group by creator_user_id
        ) agg
        join users u on u.id = agg.creator_user_id
        where agg.total > 0 and not u.banned
          ${country ? db`and u.country = ${country}` : db``}
          ${c ? db`and (agg.total < ${c.total}::numeric or (agg.total = ${c.total}::numeric and u.id > ${c.id}::uuid))` : db``}
        order by agg.total desc, u.id asc
        limit ${q.limit}`;
      return rows.map(
        (r): CreatorRankEntry => ({
          user: rowToUser(r),
          total: Number(r.rank_total),
          cursorTotal: String(r.rank_total),
        }),
      );
    },
  };
}
