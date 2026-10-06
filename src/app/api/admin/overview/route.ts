import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { currentUser, publicUser } from "@/lib/current-user";
import { isAdmin, NOT_FOUND } from "@/lib/admin";
import { networkStatus } from "@/lib/solana-server";
import { securityStatus } from "@/lib/config-check";
import { rpcEndpoint } from "@/lib/solana";

export const runtime = "nodejs";

/** Admin page data: key numbers, open reports, hidden posts, banned users, network check. */
export async function GET() {
  const me = await currentUser();
  if (!isAdmin(me)) return NextResponse.json(NOT_FOUND, { status: 404 });
  const store = getStore();
  const [stats, reports, hiddenPosts, bannedUsers, network] = await Promise.all([
    store.adminStats(),
    store.listOpenReports(50),
    store.listHiddenPosts(50),
    store.listBannedUsers(100),
    networkStatus(rpcEndpoint()),
  ]);
  return NextResponse.json({ stats, reports, hiddenPosts, bannedUsers: bannedUsers.map(publicUser), network, security: securityStatus() });
}
