/**
 * Media and profile pictures are uploaded to Arweave through Irys and served
 * by its gateway (see lib/irys.ts). The server only accepts those URLs, so a
 * post or a profile can't point to an arbitrary site (tracking pixel, phishing).
 */
const IRYS_URL = /^https:\/\/gateway\.irys\.xyz\/[A-Za-z0-9_-]{20,128}$/;

export function isIrysUrl(u: unknown): u is string {
  return typeof u === "string" && IRYS_URL.test(u);
}
