"use client";
import Link from "next/link";
import { Fragment } from "react";

// #tags (same rule as the server's tag extraction) and @usernames (3–20 of
// letters, digits, underscore, like the handle rule).
const TOKEN = /(#[\p{L}0-9_]+|@[A-Za-z0-9_]{3,20})/gu;

/**
 * Post or comment text with clickable #tags (search) and @mentions (profile).
 * Clicks don't bubble: inside a post card they open the link, not the post.
 */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(TOKEN);
  return (
    <div className={className}>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        const href =
          part[0] === "#" ? `/explore?q=${encodeURIComponent(part.toLowerCase())}` : `/profile/${part.slice(1)}`;
        return (
          <Link key={i} href={href} className="rt-link" onClick={(e) => e.stopPropagation()}>
            {part}
          </Link>
        );
      })}
    </div>
  );
}
