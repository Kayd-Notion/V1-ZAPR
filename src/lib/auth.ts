import "server-only";
import { randomBytes } from "node:crypto";
import bs58 from "bs58";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";

/**
 * Sign-in-with-Solana style message auth.
 * The server issues a nonce; the client signs a human-readable message that
 * embeds the nonce + timestamp; the server verifies the ed25519 signature
 * against the wallet pubkey before opening a session.
 */

export function generateNonce(): string {
  return bs58.encode(randomBytes(16));
}

export function buildSignInMessage(params: {
  wallet: string;
  nonce: string;
  issuedAt: number;
  domain?: string;
}): string {
  const { wallet, nonce, issuedAt, domain = "pump.social" } = params;
  return [
    `${domain} veut que tu te connectes avec ton wallet Solana.`,
    "",
    `Wallet : ${wallet}`,
    `Nonce : ${nonce}`,
    `Émis le : ${new Date(issuedAt).toISOString()}`,
    "",
    "Signer ce message ne coûte rien et n'autorise aucune transaction.",
  ].join("\n");
}

/** Basic base58 pubkey sanity check. */
export function isValidWallet(wallet: string): boolean {
  try {
    // Throws on invalid base58 / wrong length.
    // eslint-disable-next-line no-new
    new PublicKey(wallet);
    return true;
  } catch {
    return false;
  }
}

/** Verify an ed25519 signature (base58) over `message` by `wallet`. */
export function verifySignature(params: {
  wallet: string;
  message: string;
  signatureBase58: string;
}): boolean {
  const { wallet, message, signatureBase58 } = params;
  try {
    const pubkey = new PublicKey(wallet).toBytes();
    const sig = bs58.decode(signatureBase58);
    const msg = new TextEncoder().encode(message);
    return nacl.sign.detached.verify(msg, sig, pubkey);
  } catch {
    return false;
  }
}

/** Sanitize/validate a pseudo (handle). Returns normalized handle or null. */
export function normalizeHandle(input: string): string | null {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;
  // letters, digits, underscore; 3-20 chars after normalization
  const handle = trimmed.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
  if (handle.length < 3 || handle.length > 20) return null;
  return handle;
}
