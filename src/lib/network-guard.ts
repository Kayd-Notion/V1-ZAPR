import "server-only";
import { NextResponse } from "next/server";
import { IS_MAINNET } from "./solana";

/**
 * Zaps are refused on mainnet until ZAPR's on-chain program is audited: the
 * buttons are off in the interface, and the API refuses too (a product rule
 * is always enforced on both sides). Returns the answer to send, or null.
 */
export function zapsBlockedOnMainnet(): NextResponse | null {
  if (!IS_MAINNET) return null;
  return NextResponse.json(
    { error: "Zaps are disabled on mainnet until ZAPR's on-chain program is audited.", code: "mainnet_disabled" },
    { status: 403 },
  );
}
