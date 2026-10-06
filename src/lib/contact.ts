/**
 * How people reach the ZAPR team: a feedback form and/or a contact e-mail,
 * both set in Vercel (NEXT_PUBLIC_* values are written into the site when it
 * is built). Pure: tested in tests/contact.test.ts.
 *
 * Nothing is sent by ZAPR itself: the person opens the form, or their own mail
 * app. ZAPR never adds their IP address or wallet to the message.
 */

/** A plain e-mail address, or "" when it isn't one. */
export function parseEmail(raw: string | undefined): string {
  const v = (raw || "").trim().replace(/^mailto:/i, "");
  return /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(v) ? v : "";
}

/** An https:// link (a Tally / Google Forms… form), or "" when it isn't one. */
export function parseFormUrl(raw: string | undefined): string {
  const v = (raw || "").trim();
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

export const CONTACT_EMAIL = parseEmail(process.env.NEXT_PUBLIC_CONTACT_EMAIL);
export const FEEDBACK_URL = parseFormUrl(process.env.NEXT_PUBLIC_FEEDBACK_URL);
/** Is there any way to send feedback? (the buttons are hidden otherwise). */
export const FEEDBACK_ON = Boolean(FEEDBACK_URL || CONTACT_EMAIL);

export interface PageDetails {
  page: string;
  device: string;
  time: string;
}

/** What helps to understand a bug, and nothing personal (no IP, no wallet). */
export function describePage(d: PageDetails): string {
  return [`Page: ${d.page}`, `Device: ${d.device}`, `Time: ${d.time}`].join("\n");
}

/** A mailto: link with a ready-to-fill message, or "" without an address. */
export function feedbackMailto(email: string, d: PageDetails): string {
  if (!email) return "";
  const body = [
    "What happened (or your idea):",
    "",
    "",
    "What you expected:",
    "",
    "",
    "-- details (you can delete them) --",
    describePage(d),
  ].join("\n");
  return `mailto:${email}?subject=${encodeURIComponent("ZAPR beta feedback")}&body=${encodeURIComponent(body)}`;
}

/** Says once in the browser console why the feedback button is missing. */
export function reportFeedbackConfig(): void {
  if (FEEDBACK_ON) return;
  console.info(
    "[ZAPR] The feedback button is off: set NEXT_PUBLIC_FEEDBACK_URL (an https:// form link) " +
      "or NEXT_PUBLIC_CONTACT_EMAIL in Vercel, then redeploy (see docs/FEEDBACK-SETUP.md).",
  );
}
