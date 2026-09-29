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

export function shortWallet(w: string): string {
  if (!w) return "";
  return w.slice(0, 4) + "…" + w.slice(-4);
}

/** Short relative time from a ms-epoch timestamp: "12s", "4min", "3h", "2j". */
export function timeAgo(fromMs: number, nowMs: number = Date.now()): string {
  const s = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "min";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "j";
}

/** Remaining lifespan: "reste 13j", "reste 4h", "reste 12min", or "RIP". */
export function remainingLabel(remainingMs: number): string {
  const min = remainingMs / 60_000;
  if (min <= 0) return "RIP";
  if (min < 60) return "reste " + Math.max(1, Math.floor(min)) + "min";
  if (min < 1440) return "reste " + Math.floor(min / 60) + "h";
  return "reste " + Math.floor(min / 1440) + "j";
}

export const SOL_PER_LAMPORT = 1 / 1_000_000_000;
export const LAMPORTS_PER_SOL = 1_000_000_000;

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

export function lamportsToSol(lamports: number): number {
  return lamports * SOL_PER_LAMPORT;
}
