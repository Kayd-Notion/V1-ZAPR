/** Framework-agnostic formatting helpers (ported from MVP.html §C). */

export const AV_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
];

/** Deterministic avatar color from a stable id (same as MVP). */
export function avColor(id: string): string {
  let h = 0;
  for (const c of id) h = ((h * 31 + c.charCodeAt(0)) >>> 0) as number;
  return AV_COLORS[h % AV_COLORS.length];
}

export function initials(pseudo: string): string {
  return (
    pseudo
      .replace(/[@_]/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?"
  );
}

export function fmtSol(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function fmtNum(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(".0", "") + "k" : "" + n;
}

export function shortWallet(w: string): string {
  if (!w) return "";
  return w.slice(0, 4) + "…" + w.slice(-4);
}

/** Relative time from a ms-epoch timestamp. */
export function timeAgo(fromMs: number, nowMs: number = Date.now()): string {
  const h = Math.max(0, (nowMs - fromMs) / 3600_000);
  if (h < 1) return Math.round(h * 60) + "min";
  if (h < 24) return Math.round(h) + "h";
  return Math.round(h / 24) + "j";
}

/** Human label for remaining lifespan (matches MVP wording). */
export function remainingLabel(remainingMs: number): string {
  const h = remainingMs / 3600_000;
  if (h <= 0) return "Expiré";
  if (h < 1) return Math.round(h * 60) + "min restantes";
  if (h < 24) return Math.round(h) + "h restantes";
  return Math.round(h / 24) + "j restants";
}

export const SOL_PER_LAMPORT = 1 / 1_000_000_000;
export const LAMPORTS_PER_SOL = 1_000_000_000;

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

export function lamportsToSol(lamports: number): number {
  return lamports * SOL_PER_LAMPORT;
}
