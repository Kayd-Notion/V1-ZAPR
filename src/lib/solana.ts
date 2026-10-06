import { Connection } from "@solana/web3.js";
import { browserRpc, networkMatches, rpcHost } from "./rpc-config";

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

/**
 * The RPC the browser uses: NEXT_PUBLIC_SOLANA_RPC (a paid provider…), else
 * the cluster's public endpoint. The server has its own (lib/solana-server.ts).
 */
export function rpcEndpoint(): string {
  return browserRpc(CLUSTER, process.env.NEXT_PUBLIC_SOLANA_RPC);
}

const checked = new Map<string, Promise<boolean>>();

/**
 * Safety check before any zap: the RPC must really serve the network ZAPR is
 * set to (its genesis hash). A mainnet RPC pasted while the site is on devnet
 * would otherwise make zaps move real SOL. Checked once per RPC and page.
 */
export async function assertRpcNetwork(connection: Connection): Promise<void> {
  const url = connection.rpcEndpoint;
  let ok = checked.get(url);
  if (!ok) {
    ok = connection.getGenesisHash().then(
      (hash) => networkMatches(CLUSTER, url, hash),
      (e) => {
        checked.delete(url); // network hiccup: try again next time
        throw e;
      },
    );
    checked.set(url, ok);
  }
  if (!(await ok)) {
    throw new Error(
      `Zaps are paused: ZAPR's Solana connection (${rpcHost(url)}) is not on ${CLUSTER}. ` +
        "The site owner must fix NEXT_PUBLIC_SOLANA_RPC.",
    );
  }
}

/** Explorer URL for a transaction signature, cluster-aware. */
export function explorerTxUrl(signature: string): string {
  const suffix = IS_MAINNET ? "" : `?cluster=${CLUSTER}`;
  return `https://explorer.solana.com/tx/${signature}${suffix}`;
}

/** Explorer URL for an address, cluster-aware. */
export function explorerAddressUrl(address: string): string {
  const suffix = IS_MAINNET ? "" : `?cluster=${CLUSTER}`;
  return `https://explorer.solana.com/address/${address}${suffix}`;
}
