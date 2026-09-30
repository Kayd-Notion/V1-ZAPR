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
  return (Math.round(n * 100) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function shortWallet(w: string): string {
  if (!w) return "";
  return w.slice(0, 4) + "…" + w.slice(-4);
}

/** Short relative time from a ms-epoch timestamp: "12s", "4m", "3h", "2d". */
export function timeAgo(fromMs: number, nowMs: number = Date.now()): string {
  const s = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

/** Remaining lifespan: "13d left", "4h left", "12m left", or "RIP". */
export function remainingLabel(remainingMs: number): string {
  const min = remainingMs / 60_000;
  if (min <= 0) return "RIP";
  if (min < 60) return Math.max(1, Math.floor(min)) + "m left";
  if (min < 1440) return Math.floor(min / 60) + "h left";
  return Math.floor(min / 1440) + "d left";
}

export const SOL_PER_LAMPORT = 1 / 1_000_000_000;
export const LAMPORTS_PER_SOL = 1_000_000_000;

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

export function lamportsToSol(lamports: number): number {
  return lamports * SOL_PER_LAMPORT;
}
