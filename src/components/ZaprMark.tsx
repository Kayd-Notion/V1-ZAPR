"use client";
import { useId } from "react";

const BOLT = "M356 82 201 182l46 9-114 138 79 3-53 110 202-168-81-16 38-51 42 37z";

/**
 * ZAPR logo: the yellow bolt alone, no background tile, so it sits directly on
 * the page. Colors come from the theme: solid yellow with a glow in the dark
 * theme; in the light theme a yellow-to-amber gradient with a thin gold edge
 * and a small shadow, so it reads on cream without a blurry halo.
 */
export function ZaprMark({ className }: { className?: string }) {
  const gid = `zg${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg className={`zmark ${className ?? ""}`.trim()} viewBox="115 64 264 396" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--logo-top)" }} />
          <stop offset="1" style={{ stopColor: "var(--logo-bottom)" }} />
        </linearGradient>
      </defs>
      <path
        d={BOLT}
        fill={`url(#${gid})`}
        stroke="var(--logo-outline)"
        strokeWidth="14"
        strokeLinejoin="round"
        paintOrder="stroke"
      />
    </svg>
  );
}

/**
 * Loading indicator: the bolt "charging" — an empty bolt that fills with
 * yellow from the bottom, again and again.
 */
export function ZaprLoader({ label }: { label?: string }) {
  const cid = `zl${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <div className="zloader" role="status">
      <svg className="zloader-mark" viewBox="115 64 264 396" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={cid}>
            <rect className="zl-level" x="115" y="64" width="264" height="396" />
          </clipPath>
        </defs>
        <path className="zl-empty" d={BOLT} strokeWidth="12" strokeLinejoin="round" />
        <path className="zl-full" d={BOLT} clipPath={`url(#${cid})`} strokeWidth="12" strokeLinejoin="round" />
      </svg>
      {label && <span>{label}</span>}
    </div>
  );
}

/**
 * Empty-state illustration: the logo tile (dark here) with the flat yellow
 * bolt, floating above its shadow, a few sparks flickering — idle, waiting
 * for the next zap.
 */
function ZaprEmptyArt() {
  return (
    <svg className="zempty-art" viewBox="0 0 160 150" aria-hidden="true" focusable="false">
      <ellipse className="ze-shadow" cx="80" cy="140" rx="34" ry="5" />
      <g className="ze-float">
        <rect className="ze-tile" x="32" y="18" width="96" height="96" rx="24" />
        <path className="ze-bolt" transform="translate(36.3 19.4) scale(0.178)" d={BOLT} strokeWidth="10" strokeLinejoin="round" />
      </g>
      <path className="ze-spark" d="m134 24 11-11M140 42h13M121 10l4-9" />
    </svg>
  );
}

/** Empty / error state: the illustration, a punchline and an optional action. */
export function ZaprEmpty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="zempty">
      <ZaprEmptyArt />
      <b>{title}</b>
      {children}
    </div>
  );
}

/** Full-page loading screen (route transitions): the charging bolt, centered. */
export function ZaprSplash() {
  return (
    <div className="zsplash">
      <ZaprLoader label="Charging the bolt…" />
    </div>
  );
}
