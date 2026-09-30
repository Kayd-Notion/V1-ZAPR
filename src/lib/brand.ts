/**
 * Brand colors for places that cannot read CSS variables (page metadata, web
 * manifest, generated images). Same values as the tokens at the top of
 * src/app/globals.css — change both together.
 */
export const BRAND = {
  yellow: "#fed202",
  cream: "#fefdf8",
  ink: "#0a0a0b",
} as const;

/**
 * Light theme switch. ZAPR ships dark-only: the light (cream) colors stay in
 * globals.css, unused. Set to true to bring back the theme toggle in the top
 * bar and in Settings, and to honor a saved "light" choice.
 */
export const LIGHT_MODE_ENABLED = false;
