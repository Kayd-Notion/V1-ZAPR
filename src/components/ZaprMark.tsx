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

/** Loading indicator: the ZAPR bolt, pulsing. */
export function ZaprLoader({ label }: { label?: string }) {
  return (
    <div className="zloader" role="status">
      <ZaprMark className="zloader-mark" />
      {label && <span>{label}</span>}
    </div>
  );
}

/** Empty / error state with the logo, a punchline and an optional action. */
export function ZaprEmpty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="zempty">
      <ZaprMark className="zempty-mark" />
      <b>{title}</b>
      {children}
    </div>
  );
}
