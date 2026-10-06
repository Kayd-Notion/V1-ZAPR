/** Client-facing shapes returned by the API (type-only, safe to import in RSC/CSR). */
import type { MediaType } from "./db/types";

export interface ClientUser {
  id: string;
  handle: string;
  wallet: string;
  bio: string;
  country: string;
  received: number;
  given: number;
  /** SOL zapped directly to this creator. */
  zapped: number;
  hidePumpHistory: boolean;
  anonymizePumps: boolean;
  avatarUrl: string | null;
  /** Moderation: suspended account (can't post, comment, zap or follow). */
  banned: boolean;
  /** Only on the signed-in user's own record. */
  isAdmin?: boolean;
  /** Only on the signed-in user's own record: other wallets that sign in to this account. */
  linkedWallets?: ClientLinkedWallet[];
  createdAt: number;
}

export interface ClientLinkedWallet {
  wallet: string;
  /** The app it came from ("Phantom", "Privy" for a Google / Apple wallet…). */
  label: string;
  createdAt: number;
}

/** How a user appears next to their content. */
export interface ClientUserRef {
  id: string;
  handle: string;
  wallet: string;
  avatarUrl: string | null;
}

export interface ClientPost {
  id: string;
  userId: string;
  text: string;
  mediaUrl: string | null;
  mediaType: MediaType | null;
  createdAt: number;
  /** Content purged after expiry (tombstone). */
  deleted?: boolean;
  pumped: number;
  comments: number;
  country: string;
  tags: string[];
  author: ClientUserRef & { bio: string };
}

export interface ClientPumper {
  id: string;
  amount: number;
  createdAt: number;
  anonymous: boolean;
  /** Rule 1: the creator pumped their own post ("auto-pump" badge). */
  isSelfPump?: boolean;
  label: string;
  author: ClientUserRef | null;
}

export interface ClientComment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  createdAt: number;
  author: ClientUserRef;
}

export type LeaderboardPeriod = "all" | "24h" | "7d" | "30d";

/** Posts-leaderboard row. `post` is null (deleted=true) if its content was removed. */
export interface LeaderboardPostItem {
  postId: string;
  /** SOL pumped — all time, or within the selected period. */
  total: number;
  deleted: boolean;
  post: ClientPost | null;
  creator: ClientUserRef | null;
}

export interface LeaderboardCreatorItem {
  user: ClientUser;
  /** SOL received — all time, or within the selected period. */
  total: number;
}

export type ActivityKind = "zap_sent" | "creator_zap_sent" | "zap_received" | "creator_zap_received";
export type ActivityFilter = "all" | "in" | "out";

/** A line of Wallet → Activity (see /api/activity). */
export interface ClientActivity {
  id: string;
  kind: ActivityKind;
  direction: "in" | "out";
  createdAt: number;
  amount: number;
  total: number;
  counterpart: { id: string; handle: string; avatarUrl: string | null } | null;
  postId: string | null;
  postText: string | null;
  self: boolean;
  signature: string;
}

export type ReportTargetType = "post" | "comment";
export type ReportReason = "spam" | "scam" | "harassment" | "hate" | "sexual" | "illegal" | "other";

/** Admin: the open reports about one post or comment. */
export interface ClientReportGroup {
  targetType: ReportTargetType;
  targetId: string;
  count: number;
  reasons: ReportReason[];
  details: string[];
  firstAt: number;
  lastAt: number;
  text: string | null;
  mediaUrl: string | null;
  postId: string | null;
  author: { id: string; handle: string; avatarUrl: string | null; banned: boolean } | null;
  hidden: boolean;
}

export interface ClientAdminStats {
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
  /** Rankings check: self-zaps (left out of the leaderboards). */
  selfZaps: number;
  /** Rankings check: post zaps without a creator (should be 0). */
  unattributedZaps: number;
  /** Rankings check: live posts whose total differs from their zaps (should be 0). */
  postsOutOfSync: number;
}

export type NotificationKind = "post_zap" | "creator_zap" | "follow" | "comment";

/** Something that happened to the signed-in user (see /api/notifications). */
export interface ClientNotification {
  id: string;
  kind: NotificationKind;
  createdAt: number;
  /** null for an anonymous zap. */
  actor: { id: string; handle: string; avatarUrl: string | null } | null;
  /** Zaps: SOL the user received (creator share). */
  amount: number | null;
  /** The post, if it is still alive. */
  postId: string | null;
  postText: string | null;
  /** Comments: the comment text. */
  text: string | null;
}
