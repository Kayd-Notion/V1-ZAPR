import { CONTACT_EMAIL } from "@/lib/contact";

/**
 * The ZAPR contact address in the legal pages (NEXT_PUBLIC_CONTACT_EMAIL).
 * Until it is set, a clearly marked placeholder shows where it goes.
 */
export function ContactEmail() {
  if (CONTACT_EMAIL) return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <mark className="legal-placeholder" title="Set NEXT_PUBLIC_CONTACT_EMAIL in Vercel">
      [PLACEHOLDER: contact e-mail, to be added before the public launch]
    </mark>
  );
}
