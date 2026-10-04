"use client";
import { IconZap } from "@/components/icons";
import { LIFESPAN_CONFIG } from "@/lib/lifespan-config";
import { HOURS_PER_SOL, nextBoost, zapBoostHours } from "@/lib/lifespan";
import { formatSol } from "@/lib/pump-rules";

const LAMPORTS = 1e9;
const STEPS = LIFESPAN_CONFIG.stepsPerSol;

/** "3h", "1 day", "2 days 15h". */
export function fmtHours(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  const days = `${d} ${d > 1 ? "days" : "day"}`;
  return h ? `${days} ${h}h` : days;
}

/** ".10, .25, .50" — the mini milestones, as written in the help line. */
const MINI_STEPS = STEPS.filter((s) => s.at < 1)
  .map((s) => s.at.toFixed(2).slice(1))
  .join(", ");

/**
 * The post's boost gauge, in plain words: what the zap adds, the bar of the
 * SOL being filled with every milestone and the time it unlocks, then the
 * numbers (zapped so far, after the zap, next boost). With `adding`, it
 * previews a zap; without, it shows the post as it is.
 */
export function BoostGauge({ total, adding = 0 }: { total: number; adding?: number }) {
  const add = Math.max(0, adding);
  const after = total + add;
  const beforeL = Math.round(total * LAMPORTS);
  const afterL = Math.round(after * LAMPORTS);
  // The SOL being filled. A zap that lands exactly on a whole SOL shows that SOL full.
  const winStart =
    add > 0 && afterL > beforeL && afterL % LAMPORTS === 0 ? afterL - LAMPORTS : afterL - (afterL % LAMPORTS);
  const pct = (l: number) => Math.min(100, Math.max(0, ((l - winStart) / LAMPORTS) * 100));
  const beforePct = pct(beforeL);
  const afterPct = pct(afterL);

  const next = nextBoost(after);
  const toGo = next.atSol - after;
  const gained = add > 0 ? zapBoostHours(total, add) : 0;

  return (
    <div className="boost-gauge">
      <div className="bg-title">Life boost</div>

      <div className={`bg-effect${gained > 0 ? " on" : ""}`}>
        <IconZap />
        {add > 0 && gained > 0 ? (
          <span>
            Your zap adds <b>+{fmtHours(gained)}</b> to this post&apos;s life
          </span>
        ) : add > 0 ? (
          <span>
            No extra time yet. Add <b>{formatSol(toGo)} SOL</b> more to unlock <b>+{fmtHours(next.hours)}</b>
          </span>
        ) : (
          <span>
            <b>{formatSol(toGo)} SOL</b> more unlocks <b>+{fmtHours(next.hours)}</b> of life
          </span>
        )}
      </div>

      <div className="bg-bar" aria-hidden="true">
        <div className="bg-fill" style={{ width: `${beforePct}%` }} />
        {afterPct > beforePct && (
          <div className="bg-fill-add" style={{ left: `${beforePct}%`, width: `${afterPct - beforePct}%` }} />
        )}
        {STEPS.map((s) => {
          const at = s.at * 100;
          const hit = afterPct >= at;
          const fresh = hit && beforePct < at;
          return (
            <span
              key={s.at}
              className={`bg-tick${hit ? " hit" : ""}${fresh ? " fresh" : ""}`}
              style={{ left: `${at}%` }}
            />
          );
        })}
      </div>
      <div className="bg-marks" aria-hidden="true">
        {STEPS.map((s) => (
          <span
            key={s.at}
            className={`bg-mark${afterPct >= s.at * 100 ? " hit" : ""}${s.at >= 1 ? " end" : ""}`}
            style={{ left: `${s.at * 100}%` }}
          >
            +{s.hours}h
          </span>
        ))}
      </div>

      <dl className="bg-rows">
        <div>
          <dt>Zapped so far</dt>
          <dd>{formatSol(total)} SOL</dd>
        </div>
        {add > 0 && (
          <div>
            <dt>After your zap</dt>
            <dd className="accent">{formatSol(after)} SOL</dd>
          </div>
        )}
        <div>
          <dt>Next boost</dt>
          <dd>
            <span className="accent">+{fmtHours(next.hours)}</span> at {formatSol(next.atSol)} SOL
          </dd>
        </div>
      </dl>

      <p className="bg-help">
        Every SOL zapped adds {HOURS_PER_SOL}h of life, unlocked step by step at {MINI_STEPS} and the full SOL.
      </p>
    </div>
  );
}
