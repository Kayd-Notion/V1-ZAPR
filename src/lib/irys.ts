"use client";
/**
 * Media upload to Arweave via Irys, paid in SOL from the CONNECTED wallet
 * (no separate Arweave wallet — guide §Phase 1).
 *
 * We use the browser Irys uploaders (`@irys/web-upload` + `@irys/web-upload-solana`),
 * the browser counterparts of the `@irys/upload*` family: they fund uploads
 * through the injected wallet provider instead of a server-held secret key.
 *
 * SECURITY: Irys network follows NEXT_PUBLIC_IRYS_NETWORK ("devnet" by default),
 * which pairs with Solana devnet so no real value is spent pre-audit.
 */
import { WebUploader } from "@irys/web-upload";
import { WebSolana } from "@irys/web-upload-solana";
import type { MediaType } from "./db/types";

const IRYS_NETWORK = (process.env.NEXT_PUBLIC_IRYS_NETWORK || "devnet").trim();
const IS_IRYS_DEVNET = IRYS_NETWORK !== "mainnet";

export const MAX_MEDIA_BYTES = 25 * 1024 * 1024; // 25 MB soft cap for MVP

export function mediaTypeOf(file: File): MediaType | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

export interface UploadResult {
  url: string;
  mediaType: MediaType;
}

/**
 * Upload a file and return its permanent gateway URL.
 * `walletProvider` is the injected Solana provider from the connected wallet
 * (e.g. window.solana / the wallet-adapter wallet's underlying provider).
 */
export async function uploadMedia(
  file: File,
  walletProvider: unknown,
): Promise<UploadResult> {
  const mediaType = mediaTypeOf(file);
  if (!mediaType) throw new Error("Type de fichier non supporté (image ou vidéo uniquement).");
  if (file.size > MAX_MEDIA_BYTES) {
    throw new Error(`Fichier trop lourd (max ${MAX_MEDIA_BYTES / (1024 * 1024)} Mo).`);
  }

  let builder = WebUploader(WebSolana).withProvider(walletProvider);
  if (IS_IRYS_DEVNET) {
    // Devnet node — pairs with Solana devnet funding.
    builder = builder.withRpc("devnet").devnet();
  }
  const irys = await builder;

  const buffer = new Uint8Array(await file.arrayBuffer());

  // Lazy-fund: ensure enough balance to cover this upload, funded in SOL.
  const price = await irys.getPrice(buffer.byteLength);
  const balance = await irys.getLoadedBalance();
  if (balance.lt(price)) {
    await irys.fund(price.minus(balance));
  }

  const receipt = await irys.upload(Buffer.from(buffer), {
    tags: [{ name: "Content-Type", value: file.type }],
  });

  return { url: `https://gateway.irys.xyz/${receipt.id}`, mediaType };
}
