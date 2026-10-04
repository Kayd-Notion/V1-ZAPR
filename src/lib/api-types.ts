/** Contract between the UI and the app's API routes (implemented in lib/api.ts). */
import type {
  ClientActivity,
  ActivityFilter,
  ClientComment,
  ClientNotification,
  ClientPost,
  ClientPumper,
  ClientUser,
  LeaderboardCreatorItem,
  LeaderboardPeriod,
  LeaderboardPostItem,
} from "./client-types";
import type { MediaType } from "./db/types";

export interface UploadedMedia {
  url: string;
  type: MediaType;
}

/** Recipients + ratio a pump transaction must use to be accepted. */
export interface PumpConfig {
  platformWallet: string;
  creatorBps: number;
  platformBps: number;
  /** Rule 3: smallest pump accepted (SOL). */
  minPumpSol: number;
}

/**
 * What the pump modal needs about a post (rule 2 + 3). `deleted` → no pump
 * possible; `expired` → at least `minToSaveSol` to save it.
 */
export interface PumpQuote {
  status: "active" | "expired" | "deleted";
  minPumpSol: number;
  minToSaveSol: number | null;
  /** max(minPumpSol, minToSaveSol) — the confirm button needs at least this. */
  requiredMinSol: number;
}

export interface LeaderboardParams<K extends LeaderboardKind> {
  kind: K;
  scope: "world" | "country";
  period: LeaderboardPeriod;
  country?: string;
  cursor?: string | null;
  limit?: number;
}

export interface LeaderboardPage<K extends LeaderboardKind> {
  kind: K;
  period: LeaderboardPeriod;
  country: string | null;
  items: K extends "posts" ? LeaderboardPostItem[] : LeaderboardCreatorItem[];
  nextCursor: string | null;
}

/** posts: most zapped posts · creators: most zapped creators (post zaps + direct zaps received). */
export type LeaderboardKind = "posts" | "creators";

export interface FollowStats {
  followers: number;
  following: number;
  isFollowing: boolean;
}

export interface ProfilePage {
  user: ClientUser;
  postsCount: number;
  active: ClientPost[];
  follow: FollowStats;
}

export interface NotificationsPage {
  items: ClientNotification[];
  /** When the user last opened their notifications (items after it are new). */
  seenAt: number;
  nextCursor: string | null;
}

export interface ActivityPage {
  items: ClientActivity[];
  nextCursor: string | null;
}

export interface Api {
  // Auth
  nonce(wallet: string): Promise<{ message: string }>;
  verify(wallet: string, signature: string): Promise<{ user?: ClientUser; needsOnboarding?: boolean; wallet?: string }>;
  me(): Promise<{ user: ClientUser | null; needsOnboarding?: boolean; wallet?: string }>;
  logout(): Promise<{ ok: boolean }>;

  // Users
  onboard(handle: string, bio?: string): Promise<{ user: ClientUser }>;
  updateMe(
    patch: Partial<Pick<ClientUser, "bio" | "handle" | "hidePumpHistory" | "anonymizePumps" | "avatarUrl">>,
  ): Promise<{ user: ClientUser }>;
  profile(handle: string): Promise<ProfilePage>;

  // Posts
  /** Most recent posts first; `following` = only creators the user follows. */
  feed(
    cursor?: string | null,
    limit?: number,
    following?: boolean,
  ): Promise<{ posts: ClientPost[]; nextCursor: string | null }>;

  // Follows (free)
  follow(handle: string): Promise<FollowStats>;
  unfollow(handle: string): Promise<FollowStats>;
  followingIds(): Promise<{ ids: string[] }>;

  // Notifications (signed-in users)
  notifications(cursor?: string | null): Promise<NotificationsPage>;
  /** 0 for visitors. */
  unreadNotifications(): Promise<{ unread: number }>;
  markNotificationsSeen(): Promise<{ unread: number }>;

  // Wallet → Activity (signed-in users)
  activity(filter: ActivityFilter, cursor?: string | null): Promise<ActivityPage>;

  // Creator zaps (90/10 by default; no effect on posts)
  /** Server re-check before signing (auth, not self, minimum). Throws ApiError → nothing is signed. */
  prepareCreatorZap(handle: string, amountSol: number): Promise<void>;
  recordCreatorZap(
    handle: string,
    input: { amount: number; signature: string; anonymous?: boolean },
  ): Promise<{ user: ClientUser | null }>;
  /** Upload a media file; the result is passed to createPost. */
  uploadMedia(file: File, walletProvider?: unknown): Promise<UploadedMedia>;
  createPost(input: { text: string; media?: UploadedMedia | null }): Promise<{ post: ClientPost }>;
  post(id: string): Promise<{ post: ClientPost; pumpers: ClientPumper[]; comments: ClientComment[] }>;
  /** Author only, and only while the post has no zap (ApiError code has_zaps otherwise). */
  deletePost(id: string): Promise<{ ok: boolean }>;
  /** Live posts (text, #tags, author) and users (handle). */
  search(q: string): Promise<{ posts: ClientPost[]; users: ClientUser[] }>;

  // Pump
  pumpConfig(): Promise<PumpConfig>;
  /** Rules for this post right now (shown in the modal). */
  pumpQuote(postId: string): Promise<PumpQuote>;
  /**
   * Server-side re-check right BEFORE signing (post purged meanwhile? amount
   * still enough?). Throws ApiError (code post_deleted | amount_too_low_to_save
   * | below_min_pump, with the new minimum in `data`) → nothing gets signed.
   */
  preparePump(postId: string, amountSol: number): Promise<void>;
  recordPump(
    postId: string,
    input: { amount: number; signature: string; anonymous?: boolean },
  ): Promise<{ post: ClientPost }>;

  // Comments
  addComment(postId: string, text: string): Promise<{ comments: ClientComment[] }>;
  /** The comment's author or the post's author. Returns the updated list. */
  deleteComment(postId: string, commentId: string): Promise<{ comments: ClientComment[] }>;

  // Leaderboard
  leaderboard<K extends LeaderboardKind>(params: LeaderboardParams<K>): Promise<LeaderboardPage<K>>;
  geo(): Promise<{ country: string | null }>;
}
