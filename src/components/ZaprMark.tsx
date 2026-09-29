/**
 * ZAPR app icon (yellow bolt on a cream rounded square), inline so it renders
 * without a network request. Same drawing as public/brand/zapr-icon.svg.
 */
export function ZaprMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <rect width="512" height="512" rx="112" fill="#FDFBF4" />
      <path
        d="M356 82 201 182l46 9-114 138 79 3-53 110 202-168-81-16 38-51 42 37z"
        fill="#FED202"
        stroke="#FED202"
        strokeWidth="8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The bolt alone, in the current text color: for yellow buttons, where the ⚡
 * emoji (itself yellow) would disappear.
 */
export function ZapIcon() {
  return (
    <svg className="zap-ico" viewBox="129 78 236 368" aria-hidden="true" focusable="false">
      <path
        d="M356 82 201 182l46 9-114 138 79 3-53 110 202-168-81-16 38-51 42 37z"
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
