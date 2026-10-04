"use client";
import { IconZap } from "@/components/icons";
import { LIFESPAN_CONFIG } from "@/lib/lifespan-config";
import { nextBoost, zapBoostHours } from "@/lib/lifespan";
import { formatSol } from "@/lib/pump-rules";

/** "3 h", "1d 15h". */
export function fmtHours(hours: number): string {
  if (hours < 24) return `${hours} h`;
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  return h ? `${d}d ${h}h` : `${d}d`;
}

/**
 * The post's boost gauge: progress inside the current SOL, with a tick at each
 * milestone (.10 / .25 / .50 / next SOL). With `adding`, it previews a zap:
 * the gauge after the zap and the time it unlocks.
 */
export function BoostGauge({ total, adding = 0 }: { total: number; adding?: number }) {
  const after = total + Math.max(0, adding);
  const lamports = Math.round(after * 1e9);
  const inSol = (lamports % 1e9) / 1e9; // position inside the current SOL, 0..1
  const next = nextBoost(after);
  const gained = adding > 0 ? zapBoostHours(total, adding) : 0;

  return (
    <div className="boost-gauge">
      {adding > 0 && (
        <div className={`bg-effect${gained > 0 ? " on" : ""}`}>
          <IconZap />
          {gained > 0 ? (
            <b>+{fmtHours(gained)} of life</b>
          ) : (
            <span>No boost yet: {formatSol(next.atSol - after)} SOL more unlocks +{fmtHours(next.hours)}</span>
          )}
        </div>
      )}
      <div className="bg-bar" aria-hidden="true">
        <div className="bg-fill" style={{ width: `${inSol * 100}%` }} />
        {LIFESPAN_CONFIG.stepsPerSol
          .filter((s) => s.at < 1)
          .map((s) => (
            <span key={s.at} className={`bg-tick${inSol >= s.at ? " hit" : ""}`} style={{ left: `${s.at * 100}%` }} />
          ))}
      </div>
      <div className="bg-legend">
        <span>{formatSol(after)} SOL zapped</span>
        <span>
          Next boost <b>+{fmtHours(next.hours)}</b> at {formatSol(next.atSol)} SOL
        </span>
      </div>
    </div>
  );
}
