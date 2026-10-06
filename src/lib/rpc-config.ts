/**
 * Which Solana RPC (the server ZAPR talks to) to use, and a network safety
 * check. Pure: tested in tests/rpc-config.test.ts.
 *
 * Two settings, so a paid provider can be plugged in without touching code:
 *  - NEXT_PUBLIC_SOLANA_RPC: used by the browser (balances, sending zaps).
 *    Visible to everyone: use a key restricted to the site's domain.
 *  - SOLANA_RPC_URL: used by the server only (checking zaps on-chain). Never
 *    sent to browsers, so it can hold a private key. Defaults to the browser one.
 * Anything that isn't an https:// address (or http://localhost for local tests)
 * is ignored and the public Solana endpoint of the cluster is used instead.
 */

export type ClusterName = "devnet" | "testnet" | "mainnet-beta";

/** Genesis hash of each public Solana cluster: tells which network an RPC really serves. */
export const GENESIS_HASH: Record<ClusterName, string> = {
  "mainnet-beta": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  testnet: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY",
};

const PUBLIC_RPC: Record<ClusterName, string> = {
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
};

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/** A usable RPC address, or "" (then the public endpoint is used). */
export function parseRpcUrl(raw: string | undefined): string {
  const v = (raw || "").trim().replace(/^["']+|["']+$/g, "");
  if (!v) return "";
  try {
    const u = new URL(v);
    if (u.protocol === "https:") return v;
    if (u.protocol === "http:" && isLocalHost(u.hostname)) return v;
    return "";
  } catch {
    return "";
  }
}

export function publicRpc(cluster: ClusterName): string {
  return PUBLIC_RPC[cluster];
}

/** Browser RPC: NEXT_PUBLIC_SOLANA_RPC, else the cluster's public endpoint. */
export function browserRpc(cluster: ClusterName, raw: string | undefined): string {
  return parseRpcUrl(raw) || publicRpc(cluster);
}

/** Server RPC: SOLANA_RPC_URL, else the browser one. */
export function serverRpc(cluster: ClusterName, serverRaw: string | undefined, browserRaw: string | undefined): string {
  return parseRpcUrl(serverRaw) || browserRpc(cluster, browserRaw);
}

/** The RPC's host only, safe to show (no path, no API key). */
export function rpcHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid";
  }
}

/**
 * Is this RPC on the network ZAPR expects? A local test validator (localhost)
 * is accepted off-mainnet; a mainnet RPC is never accepted when the site is
 * set to devnet or testnet (zaps would move real SOL).
 */
export function networkMatches(cluster: ClusterName, rpcUrl: string, genesisHash: string): boolean {
  if (genesisHash === GENESIS_HASH[cluster]) return true;
  if (cluster === "mainnet-beta" || genesisHash === GENESIS_HASH["mainnet-beta"]) return false;
  try {
    return isLocalHost(new URL(rpcUrl).hostname);
  } catch {
    return false;
  }
}
