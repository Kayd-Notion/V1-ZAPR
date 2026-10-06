/**
 * TEST DOUBLE — shared state of the fake Privy used by the browser test
 * (tests/browser/link-google.e2e.mjs). Never part of the real site: next.config
 * only swaps it in on the dev server when ZAPR_MOCK_PRIVY=1.
 *
 * "Signed in to Google" = localStorage mockprivy_auth = "1". The Google wallet
 * is an ed25519 key kept in localStorage mockprivy_secret (base58), so the
 * test can reuse the same Google wallet across pages.
 */
import nacl from "tweetnacl";
import bs58 from "bs58";

const AUTH = "mockprivy_auth";
const SECRET = "mockprivy_secret";
const HAS_WALLET = "mockprivy_haswallet";
const listeners = new Set<() => void>();

export function isAuthed(): boolean {
  try {
    return localStorage.getItem(AUTH) === "1";
  } catch {
    return false;
  }
}

export function setAuthed(on: boolean): void {
  if (on) localStorage.setItem(AUTH, "1");
  else localStorage.removeItem(AUTH);
  listeners.forEach((fn) => fn());
}

/** Like Privy: the Solana wallet exists only once created (useCreateWallet). */
export function hasWallet(): boolean {
  try {
    return localStorage.getItem(HAS_WALLET) === "1";
  } catch {
    return false;
  }
}

export function createWallet(): void {
  if (hasWallet()) throw new Error("User already has an embedded wallet.");
  localStorage.setItem(HAS_WALLET, "1");
  listeners.forEach((fn) => fn());
}

/** Snapshot for useSyncExternalStore (a string, so it compares by value). */
export function snapshot(): string {
  return `${isAuthed() ? 1 : 0}${hasWallet() ? 1 : 0}`;
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let cached: { secret: string; wallet: object } | null = null;
let walletAddress = "";

/** The Google wallet's address (creates the key if needed). */
export function googleWalletAddress(): string {
  googleWallet();
  return walletAddress;
}

/** The Google wallet as a Wallet Standard wallet named "Privy" (like the real one). */
export function googleWallet(): object {
  let secret = localStorage.getItem(SECRET);
  if (!secret) {
    secret = bs58.encode(nacl.sign.keyPair().secretKey);
    localStorage.setItem(SECRET, secret);
  }
  if (cached?.secret === secret) return cached.wallet;
  const kp = nacl.sign.keyPair.fromSecretKey(bs58.decode(secret));
  const address = bs58.encode(kp.publicKey);
  walletAddress = address;
  const account = {
    address,
    publicKey: kp.publicKey,
    chains: ["solana:devnet", "solana:mainnet"],
    features: ["solana:signMessage", "solana:signTransaction"],
  };
  const events: ((p: unknown) => void)[] = [];
  const wallet = {
    version: "1.0.0",
    name: "Privy",
    icon: "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#4285f4"/></svg>'),
    chains: ["solana:devnet", "solana:mainnet"],
    accounts: [] as (typeof account)[],
    features: {
      "standard:connect": {
        version: "1.0.0",
        connect: async () => {
          wallet.accounts = [account];
          return { accounts: wallet.accounts };
        },
      },
      "standard:disconnect": {
        version: "1.0.0",
        disconnect: async () => {
          wallet.accounts = [];
        },
      },
      "standard:events": {
        version: "1.0.0",
        on: (_e: string, fn: (p: unknown) => void) => {
          events.push(fn);
          return () => {};
        },
      },
      "solana:signMessage": {
        version: "1.0.0",
        // Like Privy with showWalletUIs off: signs without a popup.
        signMessage: async (...inputs: { message: Uint8Array }[]) =>
          inputs.map(({ message }) => ({ signedMessage: message, signature: nacl.sign.detached(message, kp.secretKey) })),
      },
      "solana:signTransaction": {
        version: "1.0.0",
        supportedTransactionVersions: ["legacy", 0],
        signTransaction: async () => {
          throw new Error("The fake Google wallet doesn't sign transactions.");
        },
      },
    },
  };
  cached = { secret, wallet };
  return wallet;
}
