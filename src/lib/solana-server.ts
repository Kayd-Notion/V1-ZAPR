import "server-only";
import { Connection } from "@solana/web3.js";
import { CLUSTER } from "./solana";
import { networkMatches, rpcHost, serverRpc } from "./rpc-config";

/**
 * The server's Solana connection (checking zaps on-chain): SOLANA_RPC_URL if
 * set (it can hold a private API key: never sent to browsers), else the
 * browser's NEXT_PUBLIC_SOLANA_RPC, else the cluster's public endpoint.
 */
export function serverRpcEndpoint(): string {
  return serverRpc(CLUSTER, process.env.SOLANA_RPC_URL, process.env.NEXT_PUBLIC_SOLANA_RPC);
}

let conn: Connection | null = null;
export function getServerConnection(): Connection {
  if (!conn) conn = new Connection(serverRpcEndpoint(), "confirmed");
  return conn;
}

export interface NetworkStatus {
  cluster: string;
  /** Hosts only (no API key). */
  browserRpc: string;
  serverRpc: string;
  /** null = couldn't reach the RPC right now. */
  serverRpcOk: boolean | null;
}

let lastCheck: { at: number; ok: boolean | null } | null = null;

/** For /admin: which RPCs are used, and is the server one on the right network. */
export async function networkStatus(browserEndpoint: string): Promise<NetworkStatus> {
  const url = serverRpcEndpoint();
  if (!lastCheck || Date.now() - lastCheck.at > 60_000) {
    let ok: boolean | null = null;
    try {
      ok = networkMatches(CLUSTER, url, await getServerConnection().getGenesisHash());
    } catch {
      ok = null;
    }
    lastCheck = { at: Date.now(), ok };
  }
  return { cluster: CLUSTER, browserRpc: rpcHost(browserEndpoint), serverRpc: rpcHost(url), serverRpcOk: lastCheck.ok };
}

/** Server-side zap check: refuse when the server RPC is on another network. */
export async function serverRpcOnRightNetwork(): Promise<boolean | null> {
  try {
    return networkMatches(CLUSTER, serverRpcEndpoint(), await getServerConnection().getGenesisHash());
  } catch {
    return null;
  }
}
