import {
  clusterApiUrl,
  Connection,
  type Cluster,
} from "@solana/web3.js";

/**
 * Solana cluster configuration.
 *
 * SECURITY: defaults to devnet. The app must not be able to move real SOL until
 * the on-chain program is audited (guide §Phase 2-3). Flipping to mainnet is a
 * single env change (`NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta`).
 */
export type SupportedCluster = "devnet" | "testnet" | "mainnet-beta";

const raw = (process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet").trim();
export const CLUSTER: SupportedCluster =
  raw === "mainnet-beta" || raw === "testnet" ? raw : "devnet";

export const IS_MAINNET = CLUSTER === "mainnet-beta";

/** True while the app is on a safe (non-mainnet) network. */
export const IS_SAFE_NETWORK = !IS_MAINNET;

export function rpcEndpoint(): string {
  const custom = (process.env.NEXT_PUBLIC_SOLANA_RPC || "").trim();
  if (custom) return custom;
  return clusterApiUrl(CLUSTER as Cluster);
}

let _conn: Connection | null = null;
export function getConnection(): Connection {
  if (!_conn) _conn = new Connection(rpcEndpoint(), "confirmed");
  return _conn;
}

/** Explorer URL for a signature, cluster-aware. */
export function explorerTxUrl(signature: string): string {
  const suffix = IS_MAINNET ? "" : `?cluster=${CLUSTER}`;
  return `https://explorer.solana.com/tx/${signature}${suffix}`;
}

/** Explorer URL for an address, cluster-aware. */
export function explorerAddressUrl(address: string): string {
  const suffix = IS_MAINNET ? "" : `?cluster=${CLUSTER}`;
  return `https://explorer.solana.com/address/${address}${suffix}`;
}
