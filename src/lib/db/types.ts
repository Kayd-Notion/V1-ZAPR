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
  /** Profile picture (Arweave URL through the Irys gateway), or null for initials. */
  avatarUrl: string | null;
  /** Moderation: a banned user can't post, comment, zap or follow, and their content is hidden. */
  banned: boolean;
}

/**
 * Another wallet that signs in to the same account (e.g. a Google wallet linked
 * to a Phantom account). Zaps the person receives still go to `User.wallet`.
 */
export interface LinkedWallet {
  wallet: string;
  /** Which app it came from, as the wallet named itself ("Phantom", "Privy"…). */
  label: string;
  createdAt: number;
}

/** createUser's error when the wallet is already an account or a linked wallet. */
export const WALLET_IN_USE = "wallet already in use";

/** linked · already on this account · on another account · too many wallets. */
export type LinkWalletResult = "linked" | "already" | "taken" | "limit";

/** How a user appears next to their content (posts, zaps, comments…). */
export type UserRef = Pick<User, "id" | "handle" | "wallet" | "avatarUrl">;

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
  /** Moderation: hidden by an admin (appears nowhere). */
  hidden?: boolean;
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
  actor: Pick<User, "id" | "handle" | "avatarUrl"> | null;
  /** Zaps: SOL the user received (creator share). */
  amount: number | null;
  /** Post zaps and comments: the post, if it is still alive. */
  postId: string | null;
  postText: string | null;
  /** Comments: the comment text. */
  text: string | null;
}

/**
 * A line of a user's money history (Wallet → Activity), from the zap logs:
 * zaps they sent (to posts or creators) and creator shares they received.
 */
export type ActivityKind = "zap_sent" | "creator_zap_sent" | "zap_received" | "creator_zap_received";
export type ActivityFilter = "all" | "in" | "out";

export interface Activity {
  /** Stable id: kind prefix + source row id. Also the keyset tie-breaker. */
  id: string;
  kind: ActivityKind;
  direction: "in" | "out";
  createdAt: number;
  /** SOL that left the user's wallet (out: the whole zap) or reached it (in: the creator share). */
  amount: number;
  /** The whole zap, as sent by the zapper. */
  total: number;
  /** The other side: the creator paid, or the zapper (null if they zapped anonymously). */
  counterpart: Pick<User, "id" | "handle" | "avatarUrl"> | null;
  /** The zapped post, while it is alive. */
  postId: string | null;
  postText: string | null;
  /** The user zapped their own post (shows on both sides). */
  self: boolean;
  /** Solana transaction signature (explorer link). */
  signature: string;
}

/** Moderation. Users report posts and comments; admins act on them. */
export type ReportTargetType = "post" | "comment";
export type ReportReason = "spam" | "scam" | "harassment" | "hate" | "sexual" | "illegal" | "other";
export const REPORT_REASONS: ReportReason[] = ["spam", "scam", "harassment", "hate", "sexual", "illegal", "other"];

/** All the open reports about one post or comment, with what they point to. */
export interface ReportGroup {
  targetType: ReportTargetType;
  targetId: string;
  count: number;
  reasons: ReportReason[];
  details: string[];
  firstAt: number;
  lastAt: number;
  /** What was reported (null if it is gone already). */
  text: string | null;
  mediaUrl: string | null;
  /** The post itself, or the post the comment is on. */
  postId: string | null;
  author: Pick<User, "id" | "handle" | "avatarUrl" | "banned"> | null;
  hidden: boolean;
}

export interface AdminStats {
  users: number;
  bannedUsers: number;
  livePosts: number;
  hiddenPosts: number;
  zaps: number;
  solZapped: number;
  platformRevenue: number;
  zaps24h: number;
  solZapped24h: number;
  newUsers24h: number;
  openReports: number;
  /** Rankings check (read-only): zaps to yourself, left out of the leaderboards. */
  selfZaps: number;
  /** Rankings check: post zaps that can't be tied to a creator (should be 0). */
  unattributedZaps: number;
  /** Rankings check: live posts whose total differs from their zap log (should be 0). */
  postsOutOfSync: number;
}

export interface NotificationCursor {
  createdAt: number;
  id: string;
}

export type LeaderboardKind = "posts" | "creators";
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
  creator: UserRef | null;
}

export interface CreatorRankEntry {
  user: User;
  total: number;
  cursorTotal: string;
}

/** A post enriched with its author, ready for the UI. */
export interface PostWithAuthor extends Post {
  author: UserRef & Pick<User, "bio">;
}

/** A pump enriched with its author. */
export interface PumpWithAuthor extends Pump {
  author: UserRef;
}

export interface CommentWithAuthor extends Comment {
  author: UserRef;
}

/** Why a post could not be deleted (only its author can, and only before any zap). */
export type DeletePostResult = "deleted" | "not_found" | "not_author" | "has_zaps";

export interface SearchResult {
  posts: PostWithAuthor[];
  users: User[];
}

export interface Store {
  // Users
  getUserById(id: string): Promise<User | null>;
  /** The account that signs in with `wallet`: its main wallet or a linked one. */
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
    patch: Partial<Pick<User, "bio" | "handle" | "hidePumpHistory" | "anonymizePumps" | "avatarUrl">>,
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
   * A live post, or null once it has expired or when it is hidden by
   * moderation. `graceMs` also returns a post that expired less than that
   * long ago, and `includeHidden` a hidden one (recording an in-flight zap:
   * the money has moved, the record must follow).
   */
  getPost(id: string, opts?: { graceMs?: number; includeHidden?: boolean }): Promise<PostWithAuthor | null>;
  /** Live posts only: expired posts never appear anywhere. */
  listPosts(q: FeedQuery): Promise<PostWithAuthor[]>;
  /**
   * Deletes posts (with their comments) that expired before `before`. The zap
   * log is kept: it is the record of money that moved and feeds creator totals.
   */
  purgeExpired(before: number): Promise<number>;
  /**
   * Deletes a post (with its comments) for its author, only while it has
   * received no zap: once SOL moved for it, the post stays until it expires.
   */
  deletePost(postId: string, userId: string): Promise<DeletePostResult>;
  /** Live posts whose text or tags match, and users whose handle matches. */
  search(query: string, limit: number): Promise<SearchResult>;

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
  /** The comment's author or the post's author may delete it. False if not found / not allowed. */
  deleteComment(commentId: string, userId: string): Promise<boolean>;

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
  /** Money history (newest first); keyset pagination on (createdAt, id), like notifications. */
  listActivity(
    userId: string,
    opts: { limit: number; filter: ActivityFilter; before?: NotificationCursor },
  ): Promise<Activity[]>;
  /**
   * Anti-spam counter: counts one more hit for `key` in the current fixed
   * window of `windowMs` and returns the count so far in that window.
   */
  hitRateLimit(key: string, windowMs: number): Promise<number>;

  // Moderation
  /** One report per user and target; "not_found" if the target doesn't exist. */
  createReport(input: {
    reporterId: string;
    targetType: ReportTargetType;
    targetId: string;
    reason: ReportReason;
    details: string;
  }): Promise<"created" | "duplicate" | "not_found">;
  /** Open reports grouped by target, most reported first. */
  listOpenReports(limit: number): Promise<ReportGroup[]>;
  /** Closes every open report about a target. */
  resolveReports(targetType: ReportTargetType, targetId: string, status: "actioned" | "dismissed"): Promise<number>;
  setPostHidden(postId: string, hidden: boolean): Promise<boolean>;
  setUserBanned(userId: string, banned: boolean): Promise<boolean>;
  /** Admin: delete any comment. */
  removeComment(commentId: string): Promise<boolean>;
  listHiddenPosts(limit: number): Promise<PostWithAuthor[]>;
  listBannedUsers(limit: number): Promise<User[]>;
  adminStats(): Promise<AdminStats>;

  // Linked wallets (sign in to the same account; zaps still go to the main wallet)
  /** Oldest first. */
  listLinkedWallets(userId: string): Promise<LinkedWallet[]>;
  /** Refuses a wallet already used by any account, or past `max` linked wallets. */
  linkWallet(input: { userId: string; wallet: string; label: string }, max: number): Promise<LinkWalletResult>;
  unlinkWallet(userId: string, wallet: string): Promise<boolean>;

  /** When the user last opened their notifications (0 = never). */
  getNotificationsSeenAt(userId: string): Promise<number>;
  setNotificationsSeenAt(userId: string, at: number): Promise<void>;

  // Leaderboards
  leaderboardPosts(q: LeaderboardQuery): Promise<PostRankEntry[]>;
  leaderboardCreators(q: LeaderboardQuery): Promise<CreatorRankEntry[]>;
}
