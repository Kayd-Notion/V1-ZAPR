"use client";
import { useEffect } from "react";
import Link from "next/link";
import { ZaprEmpty } from "@/components/ZaprMark";
import { FeedbackLink } from "@/components/FeedbackLink";

/** Any page that crashes: a branded message instead of a blank screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ZaprEmpty title="Something broke.">
      <span>The bolt short-circuited. Try again, or head back to the feed.</span>
      <div className="zempty-actions">
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <Link href="/" className="btn">
          Back to the feed
        </Link>
      </div>
      <FeedbackLink label="Report this problem" className="error-report" />
    </ZaprEmpty>
  );
}
