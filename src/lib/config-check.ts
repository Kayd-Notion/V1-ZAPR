import "server-only";
import { onchainVerifyRequired } from "./verify-pump";
import { FOUNDER_WALLET } from "./pump-config";

/**
 * Settings that must be right before real users (read-only, for /admin). Says
 * only whether each one is OK: never shows a secret.
 */
export interface SecurityStatus {
  /** SESSION_SECRET set and long enough (otherwise sessions could be forged). */
  sessionSecretOk: boolean;
  /** Zaps checked on the blockchain before being recorded. */
  onchainVerifyOn: boolean;
  /** The platform wallet is set explicitly (not the devnet demo address). */
  founderWalletSet: boolean;
  /** CRON_SECRET set (protects the nightly clean-up). */
  cronSecretSet: boolean;
}

export function securityStatus(): SecurityStatus {
  return {
    sessionSecretOk: (process.env.SESSION_SECRET || "").length >= 32,
    onchainVerifyOn: onchainVerifyRequired(),
    founderWalletSet: Boolean((process.env.NEXT_PUBLIC_FOUNDER_WALLET || "").trim()) && Boolean(FOUNDER_WALLET),
    cronSecretSet: Boolean(process.env.CRON_SECRET),
  };
}
