import Link from "next/link";

/**
 * Layout shared by the legal pages (Terms, Privacy, Risks). Their texts are a
 * prototype draft: they must be reviewed by a lawyer before a public launch.
 */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <section className="legal">
      <div className="subbar">
        <div className="page-title">{title}</div>
      </div>
      <div className="legal-body">
        <p className="legal-draft">
          Prototype draft, last updated {updated}. To be reviewed by a lawyer before any public launch.
        </p>
        {children}
        <p className="legal-nav">
          <Link href="/how-it-works">How it works</Link> · <Link href="/terms">Terms</Link> ·{" "}
          <Link href="/privacy">Privacy</Link> · <Link href="/risks">Risks</Link>
        </p>
      </div>
    </section>
  );
}
