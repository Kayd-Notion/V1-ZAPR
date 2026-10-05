/**
 * ZAPR icon set — drawn for the brand, in the spirit of the logo bolt.
 *
 * Rules (keep new icons consistent):
 *  - 24×24 grid, 2.25px stroke, square caps, mitred (sharp) joins, no fill
 *    except the bolt and tiny accents;
 *  - straight lines and diagonals first; curves only where the object is round
 *    (moon, lens, globe, flame bottom);
 *  - signature: one small diagonal cut (a gap at 45°), like the notch of the
 *    bolt — see Feed, Search, Wallet, Comment, Bell.
 *
 * Every icon takes regular SVG props; size comes from CSS (`svg.icon`, 1.15em
 * by default) and color from `currentColor`.
 */
import type { SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement>;

function Icon({ name, className, children, ...rest }: IconProps & { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      className={`icon icon-${name}${className ? ` ${className}` : ""}`}
      {...rest}
    >
      {children}
    </svg>
  );
}

// ---- Navigation ------------------------------------------------------------

/** Feed (home): roof with the diagonal cut on its right slope. */
export const IconFeed = (p: IconProps) => (
  <Icon name="feed" {...p}>
    <path d="M3 10.2V21h6.2v-6.2h5.6V21H21V10.2" />
    <path d="M3 10.2 12 3l4.3 3.45" />
    <path d="m18.7 8.4 2.3 1.8" />
  </Icon>
);

/** Live: a diamond broadcasting two angled waves each side. */
export const IconLive = (p: IconProps) => (
  <Icon name="live" {...p}>
    <path d="M12 10.3 13.7 12 12 13.7 10.3 12z" fill="currentColor" />
    <path d="M8 8.5 5.5 12 8 15.5M16 8.5l2.5 3.5-2.5 3.5" />
    <path d="M5 5 2.3 12 5 19M19 5l2.7 7-2.7 7" />
  </Icon>
);

/** Top (trophy): faceted cup, square handles, stem and base. */
export const IconTop = (p: IconProps) => (
  <Icon name="top" {...p}>
    <path d="M7 3.5h10v5.3L14.3 13H9.7L7 8.8z" />
    <path d="M7 5.5H3.5v2.3L7 10.5M17 5.5h3.5v2.3L17 10.5" />
    <path d="M12 13v4.5M7.5 20.5h9" />
  </Icon>
);

/** Notifications: faceted bell, cut clapper line. */
export const IconBell = (p: IconProps) => (
  <Icon name="bell" {...p}>
    <path d="M4.8 17.5 6.5 15.3v-4.8L12 5l5.5 5.5v4.8l1.7 2.2z" />
    <path d="M12 2.5V5M10 21h4" />
  </Icon>
);

/** Wallet: card body with a cut corner and a square clasp. */
export const IconWallet = (p: IconProps) => (
  <Icon name="wallet" {...p}>
    <path d="M19.5 9.5v-3H6.2L3 9.7V20.5h16.5v-4" />
    <path d="M21 9.5h-5.5v7H21z" />
    <path d="M18 13h.01" />
  </Icon>
);

/** Profile: faceted head, angled shoulders. */
export const IconUser = (p: IconProps) => (
  <Icon name="user" {...p}>
    <path d="M12 3 15.3 6.3v2.2L12 11.8 8.7 8.5V6.3z" />
    <path d="M4 21v-2.6L7.4 15h9.2l3.4 3.4V21" />
  </Icon>
);

/** Settings: hex nut with a round core. */
export const IconSettings = (p: IconProps) => (
  <Icon name="settings" {...p}>
    <path d="M12 2.6 20.2 7.3v9.4L12 21.4l-8.2-4.7V7.3z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

/** Search: lens with the diagonal cut, straight handle. */
export const IconSearch = (p: IconProps) => (
  <Icon name="search" {...p}>
    <path d="M15.5 6.3A6.5 6.5 0 1 0 17 10.5" />
    <path d="m15.6 15.6 5 5" />
  </Icon>
);

/** New post. */
export const IconPlus = (p: IconProps) => (
  <Icon name="plus" {...p}>
    <path d="M12 4v16M4 12h16" />
  </Icon>
);

// ---- Theme -------------------------------------------------------------------

export const IconSun = (p: IconProps) => (
  <Icon name="sun" {...p}>
    <path d="M12 7.6 16.4 12 12 16.4 7.6 12z" />
    <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" />
  </Icon>
);

export const IconMoon = (p: IconProps) => (
  <Icon name="moon" {...p}>
    <path d="M20 14.6A8.5 8.5 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z" />
  </Icon>
);

// ---- Leaderboards & live tabs -----------------------------------------------

/** Top degens. */
export const IconCrown = (p: IconProps) => (
  <Icon name="crown" {...p}>
    <path d="M3 18 4.5 7l5 5L12 4.5l2.5 7.5 5-5L21 18z" />
    <path d="M3 21h18" />
  </Icon>
);

/** Dying. */
export const IconHourglass = (p: IconProps) => (
  <Icon name="hourglass" {...p}>
    <path d="M5.5 3h13M5.5 21h13" />
    <path d="M7 3v3.8l5 5.2-5 5.2V21M17 3v3.8L12 12l5 5.2V21" />
    <path d="M9.5 19 12 16.5l2.5 2.5z" fill="currentColor" strokeWidth={1.2} />
  </Icon>
);

/** On fire: faceted flame, inner tongue. */
export const IconFlame = (p: IconProps) => (
  <Icon name="flame" {...p}>
    <path d="m12 2.5 3.6 5.4 2.4-2L20 12.5a8 8 0 0 1-16 0l2.4-5.6L9 10.3z" />
    <path d="m12 13 2.4 3.3a2.4 2.4 0 1 1-4.8 0z" />
  </Icon>
);

/** New: four-point spark + a small twin. */
export const IconSparkle = (p: IconProps) => (
  <Icon name="sparkle" {...p}>
    <path d="m10.5 4 1.9 6.1 6.1 1.9-6.1 1.9-1.9 6.1-1.9-6.1L2.5 12l6.1-1.9z" />
    <path d="M19 2.5v5M16.5 5h5" />
  </Icon>
);

/** All: globe with an angled meridian. */
export const IconGlobe = (p: IconProps) => (
  <Icon name="globe" {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3 15.8 12 12 21 8.2 12z" />
  </Icon>
);

/** Following: two faceted people. */
export const IconUsers = (p: IconProps) => (
  <Icon name="users" {...p}>
    <path d="m9 3.5 3 3v2L9 11.5l-3-3v-2z" />
    <path d="M2.5 21v-2.3l3-3h7l3 3V21" />
    <path d="m16.5 3 2.6 2.6v1.9l-2.6 2.6-2.6-2.6V5.6z" />
    <path d="M18 14.6h.7l2.8 2.8V21" />
  </Icon>
);

// ---- The zap ------------------------------------------------------------------

const BOLT = "M356 82 201 182l46 9-114 138 79 3-53 110 202-168-81-16 38-51 42 37z";

/**
 * The zap: the logo bolt itself, flat, in the current color. On yellow buttons
 * it is white (see .pump-btn / .btn-primary in globals.css).
 */
export const IconZap = ({ className, ...rest }: IconProps) => (
  <svg
    viewBox="129 78 236 368"
    aria-hidden="true"
    focusable="false"
    className={`zap-ico${className ? ` ${className}` : ""}`}
    {...rest}
  >
    <path d={BOLT} stroke="currentColor" strokeWidth="8" strokeLinejoin="round" />
  </svg>
);

// ---- Actions & UI -------------------------------------------------------------

export const IconBack = (p: IconProps) => (
  <Icon name="back" {...p}>
    <path d="M20 12H5M11 5l-7 7 7 7" />
  </Icon>
);

/** Chevron: "go further" (a row that opens a sub-list). */
export const IconChevronRight = (p: IconProps) => (
  <Icon name="chevron-right" {...p}>
    <path d="m9 5 7 7-7 7" />
  </Icon>
);

export const IconClose = (p: IconProps) => (
  <Icon name="close" {...p}>
    <path d="m5.5 5.5 13 13M18.5 5.5l-13 13" />
  </Icon>
);

export const IconComment = (p: IconProps) => (
  <Icon name="comment" {...p}>
    <path d="M13 16.2h7.5V4H3.5v12.2H6v4.3l4.4-4.3" />
  </Icon>
);

export const IconLink = (p: IconProps) => (
  <Icon name="link" {...p}>
    <path d="M10 7H4v10h6M14 7h6v10h-6M8.5 12h7" />
  </Icon>
);

/** Report: a flag on a pole, the cloth cut at an angle. */
export const IconFlag = (p: IconProps) => (
  <Icon name="flag" {...p}>
    <path d="M5 21V3.5" />
    <path d="M5 4h13l-3 4.5 3 4.5H5" />
  </Icon>
);

/** Admin: a shield with the bolt's notch. */
export const IconShield = (p: IconProps) => (
  <Icon name="shield" {...p}>
    <path d="M12 3 4.5 6v6c0 4.5 3.2 7.6 7.5 9 4.3-1.4 7.5-4.5 7.5-9V6z" />
    <path d="m13.2 7.5-3 4.5h3.6l-3 4.5" />
  </Icon>
);

/** Check: a sharp tick. */
export const IconCheck = (p: IconProps) => (
  <Icon name="check" {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </Icon>
);

/** Ban / suspended: a circle crossed at 45°. */
export const IconBan = (p: IconProps) => (
  <Icon name="ban" {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m6 6 12 12" />
  </Icon>
);

/** Money in: an arrow landing bottom-left, with a base line. */
export const IconArrowIn = (p: IconProps) => (
  <Icon name="arrow-in" {...p}>
    <path d="M18 6 7 17M7 8.5V17h8.5" />
  </Icon>
);

/** Money out: an arrow leaving top-right. */
export const IconArrowOut = (p: IconProps) => (
  <Icon name="arrow-out" {...p}>
    <path d="M6 18 17 7M8.5 7H17v8.5" />
  </Icon>
);

/** Share: a tray with an arrow leaving it, angled like the bolt. */
export const IconShare = (p: IconProps) => (
  <Icon name="share" {...p}>
    <path d="M4.5 12.5v7h15v-7" />
    <path d="M12 15V3.8M7.5 8 12 3.5 16.5 8" />
  </Icon>
);

/** More (menu): three small diamonds, like the boost gauge ticks. */
export const IconMore = (p: IconProps) => (
  <Icon name="more" {...p}>
    <path d="m5 10.4 1.6 1.6L5 13.6 3.4 12zM12 10.4l1.6 1.6-1.6 1.6-1.6-1.6zM19 10.4l1.6 1.6-1.6 1.6-1.6-1.6z" fill="currentColor" strokeWidth={1.5} />
  </Icon>
);

export const IconTrash = (p: IconProps) => (
  <Icon name="trash" {...p}>
    <path d="M3.5 6.5h17M9.5 6.5v-3h5v3" />
    <path d="m5.8 6.5 1.2 14h10l1.2-14" />
    <path d="M10 10.5v6M14 10.5v6" />
  </Icon>
);

export const IconInfo = (p: IconProps) => (
  <Icon name="info" {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.8v.01" />
  </Icon>
);

export const IconAlert = (p: IconProps) => (
  <Icon name="alert" {...p}>
    <path d="M12 3.2 21.5 20H2.5z" />
    <path d="M12 9.5v4.8M12 17v.01" />
  </Icon>
);

/** Platform share (bank). */
export const IconPlatform = (p: IconProps) => (
  <Icon name="platform" {...p}>
    <path d="M3 9.5 12 4l9 5.5z" />
    <path d="M5.5 9.5v8M10 9.5v8M14 9.5v8M18.5 9.5v8M3 20.5h18" />
  </Icon>
);

export const IconEyeOff = (p: IconProps) => (
  <Icon name="eye-off" {...p}>
    <path d="M2.5 12 7.3 6.5h9.4l4.8 5.5-4.8 5.5H7.3z" />
    <path d="M12 9.6 14.4 12 12 14.4 9.6 12z" />
    <path d="m3.5 3.5 17 17" />
  </Icon>
);

export const IconUserPlus = (p: IconProps) => (
  <Icon name="user-plus" {...p}>
    <path d="m9 3.5 3 3v2L9 11.5l-3-3v-2z" />
    <path d="M2.5 21v-2.3l3-3h7l3 3V21" />
    <path d="M19 7v6M16 10h6" />
  </Icon>
);

export const IconUserCheck = (p: IconProps) => (
  <Icon name="user-check" {...p}>
    <path d="m9 3.5 3 3v2L9 11.5l-3-3v-2z" />
    <path d="M2.5 21v-2.3l3-3h7l3 3V21" />
    <path d="m15.5 10 2.2 2.2 4.3-4.4" />
  </Icon>
);

export const IconImagePlus = (p: IconProps) => (
  <Icon name="image-plus" {...p}>
    <path d="M13.5 3.5h-10v17h17V11" />
    <path d="m3.5 17 5.5-5.5 4 4 2.5-2.5 5 5" />
    <path d="M18.5 2v6M15.5 5h6" />
  </Icon>
);

export const IconDroplet = (p: IconProps) => (
  <Icon name="droplet" {...p}>
    <path d="M12 2.5 18.4 12.3a6.6 6.6 0 1 1-12.8 0z" />
  </Icon>
);

export const IconExternal = (p: IconProps) => (
  <Icon name="external" {...p}>
    <path d="M12.5 4.5h-8v15h15v-8" />
    <path d="m11 13 9-9M14.5 4H20v5.5" />
  </Icon>
);

export const IconLogOut = (p: IconProps) => (
  <Icon name="log-out" {...p}>
    <path d="M9.5 3.5h-6v17h6" />
    <path d="M8.5 12h12M15.5 7l5 5-5 5" />
  </Icon>
);

export const IconPin = (p: IconProps) => (
  <Icon name="pin" {...p}>
    <path d="M12 21.5 5 12.3V7l4-4h6l4 4v5.3z" />
    <path d="M12 7.2 14.2 9.4 12 11.6 9.8 9.4z" />
  </Icon>
);

/** Anonymous zapper. */
export const IconGhost = (p: IconProps) => (
  <Icon name="ghost" {...p}>
    <path d="M5 21.5V9.5a7 7 0 0 1 14 0v12l-3.5-2.4-3.5 2.4-3.5-2.4z" />
    <path d="M9.5 9.8v1.8M14.5 9.8v1.8" />
  </Icon>
);
