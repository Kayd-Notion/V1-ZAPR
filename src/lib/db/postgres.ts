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
import type {
  CommentWithAuthor,
  CreatorRankEntry,
  CreatorZap,
  FeedQuery,
  LeaderboardQuery,
  PostRankEntry,
  PostWithAuthor,
  Pump,
  PumpWithAuthor,
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
    author: { id: r.author_id, handle: r.author_handle, wallet: r.author_wallet, bio: r.author_bio },
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
function rowToPostRank(r: Row): PostRankEntry {
  return {
    postId: r.rank_post_id,
    total: Number(r.rank_total),
    cursorTotal: String(r.rank_total),
    post: r.id ? rowToPostWithAuthor(r) : null,
    creator: r.author_id ? { id: r.author_id, handle: r.author_handle, wallet: r.author_wallet } : null,
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
      const rows = await db`select * from users where wallet = ${wallet} limit 1`;
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
      const rows = await db`
        insert into users (id, handle, wallet, bio, country, created_at)
        values (${id}, ${handle}, ${wallet}, ${bio || "gm, nouveau sur ZAPR."}, ${country}, ${Date.now()})
        returning *`;
      return rowToUser(rows[0]);
    },
    async updateUser(id, patch) {
      const db = await getSql();
      const rows = await db`
        update users set
          bio = coalesce(${patch.bio ?? null}, bio),
          handle = coalesce(${patch.handle ?? null}, handle),
          hide_pump_history = coalesce(${patch.hidePumpHistory ?? null}, hide_pump_history),
          anonymize_pumps = coalesce(${patch.anonymizePumps ?? null}, anonymize_pumps)
        where id = ${id}
        returning *`;
      if (!rows[0]) throw new Error("user not found");
      return rowToUser(rows[0]);
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
        select p.*, u.id as author_id, u.handle as author_handle, u.wallet as author_wallet, u.bio as author_bio
        from posts p join users u on u.id = p.user_id
        where p.id = ${id} and p.expires_at > ${aliveAfter} limit 1`;
      return rows[0] ? rowToPostWithAuthor(rows[0]) : null;
    },
    async listPosts(q: FeedQuery) {
      const db = await getSql();
      const rows = await db`
        select p.*, u.id as author_id, u.handle as author_handle, u.wallet as author_wallet, u.bio as author_bio
        from posts p join users u on u.id = p.user_id
        where p.expires_at > ${Date.now()}
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
    async getPumpBySignature(signature) {
      const db = await getSql();
      const rows = await db`select * from pumps where signature = ${signature} limit 1`;
      return rows[0] ? rowToPump(rows[0]) : null;
    },
    async listPumpers(postId) {
      const db = await getSql();
      const rows = await db`
        select pm.*, u.id as author_id, u.handle as author_handle, u.wallet as author_wallet
        from pumps pm join users u on u.id = pm.pumper_user_id
        where pm.post_id = ${postId}
        order by pm.created_at desc`;
      return rows.map(
        (r): PumpWithAuthor => ({
          ...rowToPump(r),
          author: { id: r.author_id, handle: r.author_handle, wallet: r.author_wallet },
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
        select c.*, u.id as author_id, u.handle as author_handle, u.wallet as author_wallet
        from comments c join users u on u.id = c.user_id
        where c.post_id = ${postId}
        order by c.created_at desc`;
      return rows.map(
        (r): CommentWithAuthor => ({
          id: r.id,
          postId: r.post_id,
          userId: r.user_id,
          text: r.text,
          createdAt: Number(r.created_at),
          author: { id: r.author_id, handle: r.author_handle, wallet: r.author_wallet },
        }),
      );
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

    async leaderboardPosts(q: LeaderboardQuery) {
      const db = await getSql();
      if (!cursorIsUsable(q.cursor)) return [];
      const country = q.scope === "country" && q.country ? q.country : null;
      const c = q.cursor;

      if (q.since === undefined) {
        // All time: cumulative total on the post (double; its shortest decimal
        // string round-trips exactly, so the keyset equality is safe).
        const rows = await db`
          select p.*, p.id as rank_post_id, p.pumped as rank_total,
                 u.id as author_id, u.handle as author_handle, u.wallet as author_wallet, u.bio as author_bio
          from posts p join users u on u.id = p.user_id
          where p.expires_at > ${Date.now()}
            ${country ? db`and p.country = ${country}` : db``}
            ${c ? db`and (p.pumped < ${c.total}::float8 or (p.pumped = ${c.total}::float8 and p.id > ${c.id}::uuid))` : db``}
          order by p.pumped desc, p.id asc
          limit ${q.limit}`;
        return rows.map(rowToPostRank);
      }

      // Period: sum the per-pump log over the window, grouped by post, for posts
      // that are still alive (expired posts appear nowhere). Sums use numeric so
      // totals are exact and identical across pages (stable keyset).
      const rows = await db`
        with agg as (
          select pm.post_id, pm.creator_user_id, sum(pm.amount::numeric) as total
          from pumps pm
          where pm.created_at >= ${q.since}
            ${country ? db`and pm.post_country = ${country}` : db``}
          group by pm.post_id, pm.creator_user_id
        )
        select p.*, agg.post_id as rank_post_id, agg.total::text as rank_total,
               u.id as author_id, u.handle as author_handle, u.wallet as author_wallet, u.bio as author_bio
        from agg
        join posts p on p.id = agg.post_id
        join users u on u.id = p.user_id
        where p.expires_at > ${Date.now()}
          ${c ? db`and (agg.total < ${c.total}::numeric or (agg.total = ${c.total}::numeric and agg.post_id > ${c.id}::uuid))` : db``}
        order by agg.total desc, agg.post_id asc
        limit ${q.limit}`;
      return rows.map(rowToPostRank);
    },
    async leaderboardCreators(q: LeaderboardQuery) {
      const db = await getSql();
      if (!cursorIsUsable(q.cursor)) return [];
      const country = q.scope === "country" && q.country ? q.country : null;
      const c = q.cursor;

      const rows =
        q.since === undefined
          ? await db`
              select u.*, u.received as rank_total
              from users u
              where true
                ${country ? db`and u.country = ${country}` : db``}
                ${c ? db`and (u.received < ${c.total}::float8 or (u.received = ${c.total}::float8 and u.id > ${c.id}::uuid))` : db``}
              order by u.received desc, u.id asc
              limit ${q.limit}`
          : await db`
              with agg as (
                select pm.creator_user_id, sum(pm.creator_amount::numeric) as total
                from pumps pm
                where pm.created_at >= ${q.since} and pm.creator_user_id is not null
                group by pm.creator_user_id
              )
              select u.*, agg.total::text as rank_total
              from agg join users u on u.id = agg.creator_user_id
              where true
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
    async leaderboardZapped(q: LeaderboardQuery) {
      const db = await getSql();
      if (!cursorIsUsable(q.cursor)) return [];
      const country = q.scope === "country" && q.country ? q.country : null;
      const c = q.cursor;
      const rows =
        q.since === undefined
          ? await db`
              select u.*, u.zapped as rank_total
              from users u
              where u.zapped > 0
                ${country ? db`and u.country = ${country}` : db``}
                ${c ? db`and (u.zapped < ${c.total}::float8 or (u.zapped = ${c.total}::float8 and u.id > ${c.id}::uuid))` : db``}
              order by u.zapped desc, u.id asc
              limit ${q.limit}`
          : await db`
              with agg as (
                select cz.creator_user_id, sum(cz.amount::numeric) as total
                from creator_zaps cz
                where cz.created_at >= ${q.since}
                group by cz.creator_user_id
              )
              select u.*, agg.total::text as rank_total
              from agg join users u on u.id = agg.creator_user_id
              where true
                ${country ? db`and u.country = ${country}` : db``}
                ${c ? db`and (agg.total < ${c.total}::numeric or (agg.total = ${c.total}::numeric and u.id > ${c.id}::uuid))` : db``}
              order by agg.total desc, u.id asc
              limit ${q.limit}`;
      return rows.map(
        (r): CreatorRankEntry => ({ user: rowToUser(r), total: Number(r.rank_total), cursorTotal: String(r.rank_total) }),
      );
    },
  };
}
