/** Domain model shared by every storage implementation. Timestamps are ms epoch. */

export type MediaType = "image" | "video";

export interface User {
  id: string;
  handle: string; // pseudo, unique (without @)
  wallet: string; // base58 pubkey, unique
  bio: string;
  country: string; // ISO-2, best-effort from IP at creation, adjustable
  createdAt: number;
  /** Running total of creator shares received (SOL) — for creators leaderboard. */
  received: number;
  /** Running total of SOL this user has sent as zaps (posts and creators). */
  given: number;
  /** Running total of SOL zapped directly to this creator (creator zaps). */
  zapped: number;
  /** Privacy: hide "given" total on public profile. */
  hidePumpHistory: boolean;
  /** Privacy: appear anonymous in pumpers lists by default. */
  anonymizePumps: boolean;
}

export interface Post {
  id: string;
  userId: string;
  text: string;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  createdAt: number;
  /** Cumulative SOL pumped on this post — drives lifespan + posts leaderboard. */
  pumped: number;
  comments: number;
  country: string;
  tags: string[];
}

export interface Pump {
  id: string;
  postId: string;
  pumperUserId: string;
  amount: number; // total SOL
  creatorAmount: number; // SOL to creator
  founderAmount: number; // SOL to founder (Kayd)
  signature: string; // on-chain tx signature
  anonymous: boolean;
  createdAt: number;
  /**
   * Snapshot of the post's creator and country at pump time. Stored on the pump
   * itself so period leaderboards only depend on pump history — they keep
   * working even if the post content is later removed from storage.
   */
  creatorUserId: string;
  postCountry: string;
}

/** A zap sent straight to a creator (not to a post): no effect on posts. */
export interface CreatorZap {
  id: string;
  creatorUserId: string;
  zapperUserId: string;
  amount: number; // total SOL
  creatorAmount: number;
  founderAmount: number;
  signature: string;
  anonymous: boolean;
  createdAt: number;
}

/** Social graph: follower follows followee (free, no money involved). */
export interface FollowStats {
  followers: number;
  following: number;
  /** Whether the viewer follows this user (false for visitors). */
  isFollowing: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: number;
}

/**
 * Something that happened to a user, derived from the existing logs (no
 * separate events table): a zap on one of their posts, a zap straight to
 * them, a new follower, a comment on one of their posts. Their own actions
 * (self-zap, own comment) are never notified.
 */
export type NotificationKind = "post_zap" | "creator_zap" | "follow" | "comment";

export interface Notification {
  /** Stable id: kind prefix + source row id. Also the keyset tie-breaker. */
  id: string;
  kind: NotificationKind;
  createdAt: number;
  /** Who did it; null for an anonymous zap (or a deleted account). */
  actor: Pick<User, "id" | "handle"> | null;
  /** Zaps: SOL the user received (creator share). */
  amount: number | null;
  /** Post zaps and comments: the post, if it is still alive. */
  postId: string | null;
  postText: string | null;
  /** Comments: the comment text. */
  text: string | null;
}

export interface NotificationCursor {
  createdAt: number;
  id: string;
}

export type LeaderboardKind = "posts" | "creators" | "zapped";
export type LeaderboardScope = "world" | "country";

export interface FeedQuery {
  limit: number;
  /** Cursor: return items created strictly before this ms timestamp. */
  before?: number;
  authorId?: string;
  /** Only posts by these authors (the "Abonnements" feed). */
  authorIds?: string[];
}

export type LeaderboardPeriod = "all" | "24h" | "7d" | "30d";

/**
 * Keyset cursor: the (total, id) of the last row already returned.
 * `total` is kept as an exact decimal string so equality on ties is reliable.
 */
export interface LeaderboardCursor {
  total: string;
  id: string;
}

export interface LeaderboardQuery {
  kind: LeaderboardKind;
  scope: LeaderboardScope;
  country?: string;
  limit: number;
  /**
   * Window start (ms epoch). Undefined = all time, which reads the cumulative
   * totals (post.pumped / user.received); otherwise pumps are summed from the
   * per-pump log over [since, now].
   */
  since?: number;
  cursor?: LeaderboardCursor;
}

/** A posts-leaderboard row (live posts only). */
export interface PostRankEntry {
  postId: string;
  total: number;
  /** Exact sort key for the next cursor. */
  cursorTotal: string;
  post: PostWithAuthor | null;
  creator: Pick<User, "id" | "handle" | "wallet"> | null;
}

export interface CreatorRankEntry {
  user: User;
  total: number;
  cursorTotal: string;
}

/** A post enriched with its author, ready for the UI. */
export interface PostWithAuthor extends Post {
  author: Pick<User, "id" | "handle" | "wallet" | "bio">;
}

/** A pump enriched with its author. */
export interface PumpWithAuthor extends Pump {
  author: Pick<User, "id" | "handle" | "wallet">;
}

export interface CommentWithAuthor extends Comment {
  author: Pick<User, "id" | "handle" | "wallet">;
}

export interface Store {
  // Users
  getUserById(id: string): Promise<User | null>;
  getUserByWallet(wallet: string): Promise<User | null>;
  getUserByHandle(handle: string): Promise<User | null>;
  createUser(input: {
    handle: string;
    wallet: string;
    bio?: string;
    country?: string;
  }): Promise<User>;
  updateUser(
    id: string,
    patch: Partial<Pick<User, "bio" | "handle" | "hidePumpHistory" | "anonymizePumps">>,
  ): Promise<User>;

  // Posts
  createPost(input: {
    userId: string;
    text: string;
    mediaUrl?: string | null;
    mediaType?: MediaType | null;
    country?: string;
    tags?: string[];
  }): Promise<Post>;
  /**
   * A live post, or null once it has expired. `graceMs` also returns a post
   * that expired less than that long ago (recording an in-flight zap).
   */
  getPost(id: string, opts?: { graceMs?: number }): Promise<PostWithAuthor | null>;
  /** Live posts only: expired posts never appear anywhere. */
  listPosts(q: FeedQuery): Promise<PostWithAuthor[]>;
  /**
   * Deletes posts (with their comments) that expired before `before`. The zap
   * log is kept: it is the record of money that moved and feeds creator totals.
   */
  purgeExpired(before: number): Promise<number>;

  // Pumps
  recordPump(input: {
    postId: string;
    pumperUserId: string;
    amount: number;
    creatorAmount: number;
    founderAmount: number;
    signature: string;
    anonymous: boolean;
  }): Promise<{ pump: Pump; post: Post }>;
  getPumpBySignature(signature: string): Promise<Pump | null>;
  listPumpers(postId: string): Promise<PumpWithAuthor[]>;

  // Comments
  addComment(input: { postId: string; userId: string; text: string }): Promise<Comment>;
  listComments(postId: string): Promise<CommentWithAuthor[]>;

  // Follows (free)
  follow(followerId: string, followeeId: string): Promise<void>;
  unfollow(followerId: string, followeeId: string): Promise<void>;
  followStats(userId: string, viewerId: string | null): Promise<FollowStats>;
  listFollowingIds(userId: string): Promise<string[]>;

  // Creator zaps (money straight to a creator; no effect on posts)
  recordCreatorZap(input: {
    creatorUserId: string;
    zapperUserId: string;
    amount: number;
    creatorAmount: number;
    founderAmount: number;
    signature: string;
    anonymous: boolean;
  }): Promise<CreatorZap>;
  getCreatorZapBySignature(signature: string): Promise<CreatorZap | null>;

  // Notifications (derived from zaps, creator zaps, follows and comments)
  /** Newest first; keyset pagination on (createdAt, id). */
  listNotifications(userId: string, opts: { limit: number; before?: NotificationCursor }): Promise<Notification[]>;
  /** Notifications newer than `after` (capped at 100). */
  countNotificationsSince(userId: string, after: number): Promise<number>;
  /** When the user last opened their notifications (0 = never). */
  getNotificationsSeenAt(userId: string): Promise<number>;
  setNotificationsSeenAt(userId: string, at: number): Promise<void>;

  // Leaderboards
  leaderboardPosts(q: LeaderboardQuery): Promise<PostRankEntry[]>;
  leaderboardCreators(q: LeaderboardQuery): Promise<CreatorRankEntry[]>;
  /** Creators ranked by SOL zapped to them directly (all time or period). */
  leaderboardZapped(q: LeaderboardQuery): Promise<CreatorRankEntry[]>;
}
