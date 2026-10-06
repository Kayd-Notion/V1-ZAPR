// RPC settings and the network safety check (lib/rpc-config.ts, lib/solana.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Connection } from "@solana/web3.js";
import {
  GENESIS_HASH,
  browserRpc,
  networkMatches,
  parseRpcUrl,
  rpcHost,
  serverRpc,
} from "../src/lib/rpc-config";
import { assertRpcNetwork } from "../src/lib/solana";
import { sendPump } from "../src/lib/pump";

const HELIUS_DEVNET = "https://devnet.helius-rpc.com/?api-key=k123";

test("RPC address: https (or localhost) only, quotes and spaces removed", () => {
  assert.equal(parseRpcUrl(` "${HELIUS_DEVNET}" `), HELIUS_DEVNET);
  assert.equal(parseRpcUrl("http://127.0.0.1:8899"), "http://127.0.0.1:8899");
  for (const bad of [undefined, "", "devnet.helius-rpc.com", "http://rpc.example.com", "ftp://x", "not a url"]) {
    assert.equal(parseRpcUrl(bad), "", String(bad));
  }
});

test("browser and server RPCs: settings first, then the public endpoint", () => {
  assert.equal(browserRpc("devnet", undefined), "https://api.devnet.solana.com");
  assert.equal(browserRpc("devnet", HELIUS_DEVNET), HELIUS_DEVNET);
  assert.equal(browserRpc("devnet", "oops"), "https://api.devnet.solana.com");
  // The server uses its own (private) one when set, else the browser one.
  assert.equal(serverRpc("devnet", "https://private.example.com/k", HELIUS_DEVNET), "https://private.example.com/k");
  assert.equal(serverRpc("devnet", undefined, HELIUS_DEVNET), HELIUS_DEVNET);
  assert.equal(serverRpc("devnet", undefined, undefined), "https://api.devnet.solana.com");
});

test("the host shown in /admin never includes the API key", () => {
  assert.equal(rpcHost(HELIUS_DEVNET), "devnet.helius-rpc.com");
  assert.equal(rpcHost("https://x.quiknode.pro/secret-token/"), "x.quiknode.pro");
});

test("network check: a mainnet RPC is never accepted on devnet", () => {
  assert.equal(networkMatches("devnet", HELIUS_DEVNET, GENESIS_HASH.devnet), true);
  assert.equal(networkMatches("devnet", "https://mainnet.helius-rpc.com/?api-key=k", GENESIS_HASH["mainnet-beta"]), false);
  assert.equal(networkMatches("devnet", HELIUS_DEVNET, GENESIS_HASH.testnet), false);
  // Local test validator: any genesis, but never mainnet's.
  assert.equal(networkMatches("devnet", "http://127.0.0.1:8899", "LocalGenesis111"), true);
  assert.equal(networkMatches("devnet", "http://127.0.0.1:8899", GENESIS_HASH["mainnet-beta"]), false);
  assert.equal(networkMatches("mainnet-beta", "http://127.0.0.1:8899", "LocalGenesis111"), false);
});

const fakeConnection = (rpcEndpoint: string, genesis: string) =>
  ({ rpcEndpoint, getGenesisHash: async () => genesis }) as unknown as Connection;

test("a zap is refused before the wallet opens if the RPC is on mainnet", async () => {
  const wrong = fakeConnection("https://mainnet.helius-rpc.com/?api-key=k", GENESIS_HASH["mainnet-beta"]);
  await assert.rejects(assertRpcNetwork(wrong), /Zaps are paused: .*mainnet\.helius-rpc\.com.* is not on devnet/);
  let walletOpened = false;
  await assert.rejects(
    sendPump({
      connection: wrong,
      sendTransaction: async () => {
        walletOpened = true;
        return "x";
      },
      payer: { toBase58: () => "x" },
      creatorWallet: "x",
      amountSol: 0.1,
    } as unknown as Parameters<typeof sendPump>[0]),
    /Zaps are paused/,
  );
  assert.equal(walletOpened, false);
  await assertRpcNetwork(fakeConnection(HELIUS_DEVNET, GENESIS_HASH.devnet)); // fine
});
