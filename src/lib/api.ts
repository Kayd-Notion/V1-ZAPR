"use client";
import type {
  ClientComment,
  ClientPost,
  ClientPumper,
  ClientUser,
} from "./client-types";
import type {
  ActivityPage,
  Api,
  FollowStats,
  LeaderboardKind,
  LeaderboardPage,
  LeaderboardParams,
  NotificationsPage,
  ProfilePage,
  PumpQuote,
} from "./api-types";
import { FOUNDER_WALLET, MIN_PUMP_SOL, resolvedSplitBps } from "./pump-config";
import { ApiError } from "./api-error";

/** Thin fetch wrapper: JSON, credentials, and typed errors. */
async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      (data.error as string) || `Erreur ${res.status}`,
      (data.code as string) ?? null,
      res.status,
      data,
    );
  }
  return data as T;
}

/** The whole UI talks to the app's own API routes (/api/*) through this. */
export const api: Api = {
  // Auth
  nonce: (wallet) => req<{ message: string }>(`/api/auth/nonce?wallet=${encodeURIComponent(wallet)}`),
  verify: (wallet, signature) =>
    req("/api/auth/verify", { method: "POST", body: JSON.stringify({ wallet, signature }) }),
  me: () => req("/api/auth/me"),
  logout: () => req("/api/auth/logout", { method: "POST" }),

  // Users
  onboard: (handle, bio) =>
    req<{ user: ClientUser }>("/api/users", { method: "POST", body: JSON.stringify({ handle, bio }) }),
  updateMe: (patch) =>
    req<{ user: ClientUser }>("/api/users/me", { method: "PATCH", body: JSON.stringify(patch) }),
  profile: (handle) => req<ProfilePage>(`/api/users/${encodeURIComponent(handle)}`),

  // Posts
  feed: async (cursor, limit = 20, following = false) => {
    const p = new URLSearchParams({ limit: String(limit) });
    if (following) p.set("following", "1");
    if (cursor) p.set("before", cursor);
    const r = await req<{ posts: ClientPost[]; nextCursor: number | null }>(`/api/posts?${p}`);
    return { posts: r.posts, nextCursor: r.nextCursor === null ? null : String(r.nextCursor) };
  },
  // Arweave via Irys, paid in SOL from the connected wallet.
  uploadMedia: async (file, walletProvider) => {
    const { uploadMedia } = await import("./irys");
    const r = await uploadMedia(file, walletProvider);
    return { url: r.url, type: r.mediaType };
  },
  createPost: ({ text, media }) =>
    req<{ post: ClientPost }>("/api/posts", {
      method: "POST",
      body: JSON.stringify({ text, mediaUrl: media?.url ?? null, mediaType: media?.type ?? null }),
    }),
  post: (id) =>
    req<{ post: ClientPost; pumpers: ClientPumper[]; comments: ClientComment[] }>(`/api/posts/${id}`),
  deletePost: (id) => req<{ ok: boolean }>(`/api/posts/${id}`, { method: "DELETE" }),
  search: (q) => req<{ posts: ClientPost[]; users: ClientUser[] }>(`/api/search?q=${encodeURIComponent(q)}`),

  // Pump
  pumpConfig: async () => {
    const { creatorBps, founderBps } = resolvedSplitBps();
    return { platformWallet: FOUNDER_WALLET, creatorBps, platformBps: founderBps, minPumpSol: MIN_PUMP_SOL };
  },
  pumpQuote: (postId) => req<PumpQuote>(`/api/posts/${postId}/pump-quote`),
  preparePump: async (postId, amountSol) => {
    await req(`/api/posts/${postId}/pump/prepare`, { method: "POST", body: JSON.stringify({ amount: amountSol }) });
  },
  recordPump: (postId, { amount, signature, anonymous }) =>
    req<{ post: ClientPost }>(`/api/posts/${postId}/pump`, {
      method: "POST",
      body: JSON.stringify({ amount, signature, anonymous }),
    }),

  // Follows
  follow: (handle) => req<FollowStats>(`/api/users/${encodeURIComponent(handle)}/follow`, { method: "POST" }),
  unfollow: (handle) => req<FollowStats>(`/api/users/${encodeURIComponent(handle)}/follow`, { method: "DELETE" }),
  followingIds: () => req<{ ids: string[] }>("/api/follows"),

  // Notifications
  notifications: (cursor) =>
    req<NotificationsPage>(cursor ? `/api/notifications?cursor=${encodeURIComponent(cursor)}` : "/api/notifications"),
  unreadNotifications: () => req<{ unread: number }>("/api/notifications/unread"),
  markNotificationsSeen: () => req<{ unread: number }>("/api/notifications/seen", { method: "POST" }),

  // Activity
  activity: (filter, cursor) => {
    const p = new URLSearchParams({ filter });
    if (cursor) p.set("cursor", cursor);
    return req<ActivityPage>(`/api/activity?${p}`);
  },

  // Creator zaps
  prepareCreatorZap: async (handle, amountSol) => {
    await req(`/api/users/${encodeURIComponent(handle)}/zap/prepare`, {
      method: "POST",
      body: JSON.stringify({ amount: amountSol }),
    });
  },
  recordCreatorZap: (handle, { amount, signature, anonymous }) =>
    req<{ user: ClientUser | null }>(`/api/users/${encodeURIComponent(handle)}/zap`, {
      method: "POST",
      body: JSON.stringify({ amount, signature, anonymous }),
    }),

  // Comments
  addComment: (postId, text) =>
    req<{ comments: ClientComment[] }>(`/api/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  deleteComment: (postId, commentId) =>
    req<{ comments: ClientComment[] }>(`/api/posts/${postId}/comments/${commentId}`, { method: "DELETE" }),

  // Leaderboard
  leaderboard: <K extends LeaderboardKind>(params: LeaderboardParams<K>) => {
    const p = new URLSearchParams({
      kind: params.kind,
      scope: params.scope,
      period: params.period,
      limit: String(params.limit ?? 20),
    });
    if (params.country) p.set("country", params.country);
    if (params.cursor) p.set("cursor", params.cursor);
    return req<LeaderboardPage<K>>(`/api/leaderboard?${p}`);
  },

  geo: () => req<{ country: string }>("/api/geo"),
};
