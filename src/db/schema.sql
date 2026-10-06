-- ZAPR — Postgres schema (Supabase / Neon).
-- Timestamps are stored as bigint (ms epoch) to match the domain model exactly.

create extension if not exists "pgcrypto";

create table if not exists users (
  id                 uuid primary key default gen_random_uuid(),
  handle             text not null unique,
  wallet             text not null unique,
  bio                text not null default '',
  country            text not null default 'FR',
  created_at         bigint not null,
  received           double precision not null default 0,
  given              double precision not null default 0,
  hide_pump_history  boolean not null default false,
  anonymize_pumps    boolean not null default false
);
-- Total SOL zapped directly to this creator (creator zaps).
alter table users add column if not exists zapped double precision not null default 0;
create index if not exists users_received_idx on users (received desc);
create index if not exists users_zapped_id_idx on users (zapped desc, id);
create index if not exists users_country_idx on users (country);
-- When the user last opened their notifications (ms epoch, 0 = never).
alter table users add column if not exists notifications_seen_at bigint not null default 0;
-- Profile picture (Arweave URL through the Irys gateway); null = initials.
alter table users add column if not exists avatar_url text;

create table if not exists posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  text        text not null,
  media_url   text,
  media_type  text,
  created_at  bigint not null,
  pumped      double precision not null default 0,
  comments    integer not null default 0,
  country     text not null default 'FR',
  tags        text[] not null default '{}'
);
-- Expiry (ms epoch), kept in sync by the app on create and on every zap:
-- expired posts are hidden from every read, then deleted by the purge.
alter table posts add column if not exists expires_at bigint;
create index if not exists posts_expires_idx on posts (expires_at);
create index if not exists posts_created_idx on posts (created_at desc);
create index if not exists posts_pumped_idx on posts (pumped desc);
create index if not exists posts_country_idx on posts (country);
-- A creator's posts (profile, notifications for comments on them).
create index if not exists posts_user_idx on posts (user_id);

-- One row per pump (the per-pump log). It is the source for period
-- leaderboards, so it must outlive post content: post_id deliberately has NO
-- foreign key / ON DELETE CASCADE, and the creator + post country are
-- snapshotted on the row at pump time.
create table if not exists pumps (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid not null,
  pumper_user_id  uuid not null references users(id) on delete cascade,
  amount          double precision not null,
  creator_amount  double precision not null,
  founder_amount  double precision not null,
  signature       text not null unique,
  anonymous       boolean not null default false,
  created_at      bigint not null,
  creator_user_id uuid,
  post_country    text
);

-- Migration for databases created before the period leaderboards.
alter table pumps add column if not exists creator_user_id uuid;
alter table pumps add column if not exists post_country text;
alter table pumps drop constraint if exists pumps_post_id_fkey;
update pumps pm
  set creator_user_id = p.user_id, post_country = p.country
  from posts p
  where p.id = pm.post_id and (pm.creator_user_id is null or pm.post_country is null);

create index if not exists pumps_post_idx on pumps (post_id, created_at desc);
-- Window scans for period leaderboards (all / by country / by creator).
create index if not exists pumps_created_idx on pumps (created_at);
create index if not exists pumps_country_created_idx on pumps (post_country, created_at);
create index if not exists pumps_creator_created_idx on pumps (creator_user_id, created_at);
-- Keyset pagination on the all-time boards (total desc, id asc).
create index if not exists posts_pumped_id_idx on posts (pumped desc, id);
create index if not exists users_received_id_idx on users (received desc, id);

create table if not exists comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references posts(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  text        text not null,
  created_at  bigint not null
);
create index if not exists comments_post_idx on comments (post_id, created_at desc);

-- Follows: free, one row per (follower, followee).
create table if not exists follows (
  follower_id  uuid not null references users(id) on delete cascade,
  followee_id  uuid not null references users(id) on delete cascade,
  created_at   bigint not null,
  primary key (follower_id, followee_id)
);
create index if not exists follows_followee_idx on follows (followee_id);

-- Zaps sent straight to a creator (not to a post). Append-only log of money
-- that moved: source of the "Zappés" leaderboard over a period.
create table if not exists creator_zaps (
  id               uuid primary key default gen_random_uuid(),
  creator_user_id  uuid not null references users(id) on delete cascade,
  zapper_user_id   uuid not null references users(id) on delete cascade,
  amount           double precision not null,
  creator_amount   double precision not null,
  founder_amount   double precision not null,
  signature        text not null unique,
  anonymous        boolean not null default false,
  created_at       bigint not null
);
create index if not exists creator_zaps_created_idx on creator_zaps (created_at);
create index if not exists creator_zaps_creator_idx on creator_zaps (creator_user_id, created_at);
-- Wallet activity: what a user sent.
create index if not exists pumps_pumper_idx on pumps (pumper_user_id, created_at);
create index if not exists creator_zaps_zapper_idx on creator_zaps (zapper_user_id, created_at);

-- Moderation. A hidden post, or any post of a banned user, disappears from
-- every read; a banned user can't post, comment, zap or follow anymore.
alter table posts add column if not exists hidden boolean not null default false;
alter table users add column if not exists banned boolean not null default false;

-- Reports from users: one per reporter and target. Resolved by an admin
-- (hide / delete / ban = "actioned", or "dismissed").
create table if not exists reports (
  id           uuid primary key default gen_random_uuid(),
  target_type  text not null check (target_type in ('post', 'comment')),
  target_id    uuid not null,
  reporter_id  uuid not null references users(id) on delete cascade,
  reason       text not null,
  details      text not null default '',
  status       text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at   bigint not null,
  resolved_at  bigint,
  unique (target_type, target_id, reporter_id)
);
create index if not exists reports_open_idx on reports (status, created_at desc);

-- Anti-spam: fixed-window counters (one row per action and user / wallet).
-- Never keyed by IP address: visitor IPs are not stored.
create table if not exists rate_limits (
  key           text primary key,
  window_start  bigint not null,
  count         integer not null
);

-- Linked wallets: more wallets that sign in to the same account (e.g. a Google
-- wallet linked to a Phantom account). The main wallet stays users.wallet and
-- keeps receiving the zaps. A wallet belongs to one account only.
create table if not exists user_wallets (
  wallet      text primary key,
  user_id     uuid not null references users(id) on delete cascade,
  label       text not null default '',
  created_at  bigint not null
);
create index if not exists user_wallets_user_idx on user_wallets (user_id, created_at);
