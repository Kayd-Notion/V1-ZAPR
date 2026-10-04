"use client";
import { useState } from "react";
import { IconGhost } from "@/components/icons";
import { avColor, initials } from "@/lib/format";

export function Avatar({
  id,
  handle,
  src = null,
  size = "",
  anonymous = false,
}: {
  id: string;
  handle: string;
  /** Profile picture; initials on a color when missing or broken. */
  src?: string | null;
  size?: "" | "xs" | "sm" | "lg";
  anonymous?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  if (anonymous) {
    return (
      <div className={`avatar anon ${size}`.trim()} aria-label="Anonymous">
        <IconGhost />
      </div>
    );
  }
  if (src && !broken) {
    return (
      <div className={`avatar has-img ${size}`.trim()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={handle} loading="lazy" onError={() => setBroken(true)} />
      </div>
    );
  }
  return (
    <div className={`avatar ${size}`.trim()} style={{ background: avColor(id) }}>
      {initials(handle)}
    </div>
  );
}
