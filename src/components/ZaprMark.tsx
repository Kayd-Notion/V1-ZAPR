const BOLT = "M356 82 201 182l46 9-114 138 79 3-53 110 202-168-81-16 38-51 42 37z";

/**
 * ZAPR logo: the yellow bolt alone, no background tile, so it sits directly on
 * the page with a yellow halo (--logo-glow, stronger in the light theme).
 */
export function ZaprMark({ className }: { className?: string }) {
  return (
    <svg className={`zmark ${className ?? ""}`.trim()} viewBox="115 64 264 396" aria-hidden="true" focusable="false">
      <path
        d={BOLT}
        fill="#FED202"
        stroke="var(--logo-outline)"
        strokeWidth="22"
        strokeLinejoin="round"
        paintOrder="stroke"
      />
    </svg>
  );
}

/**
 * The bolt alone, in the current text color: for yellow buttons, where the ⚡
 * emoji (itself yellow) would disappear.
 */
export function ZapIcon({ className }: { className?: string }) {
  return (
    <svg className={`zap-ico ${className ?? ""}`.trim()} viewBox="129 78 236 368" aria-hidden="true" focusable="false">
      <path
        d={BOLT}
        stroke="currentColor"
        strokeWidth="8"
        strokeLinejoin="round"
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
