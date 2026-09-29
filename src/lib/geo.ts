import "server-only";
import type { NextRequest } from "next/server";

/**
 * Country is derived from the request IP at request time and never stored as an
 * IP (guide §Classements: "géoloc IP à la volée, non stockée"). Only the
 * resulting ISO-2 country code is used/persisted (e.g. as a post's country).
 *
 * In production behind Vercel/Cloudflare the edge injects the country header.
 * Locally there is no such header, so we fall back to DEFAULT_COUNTRY.
 */
const DEFAULT_COUNTRY = (process.env.DEFAULT_COUNTRY || "FR").toUpperCase();

const KNOWN = new Set(["FR", "US", "JP", "BR", "GB", "DE", "ES", "IT", "CA", "IN"]);

export function countryFromRequest(req: NextRequest): string {
  const h = req.headers;
  const candidates = [
    h.get("x-vercel-ip-country"),
    h.get("cf-ipcountry"),
    h.get("x-country-code"),
  ];
  for (const c of candidates) {
    if (c && c.length === 2 && c !== "XX") return c.toUpperCase();
  }
  return DEFAULT_COUNTRY;
}

/** Normalize a user-selected country code, falling back to default. */
export function normalizeCountry(code: string | null | undefined): string {
  if (!code) return DEFAULT_COUNTRY;
  const up = code.toUpperCase();
  return up.length === 2 ? up : DEFAULT_COUNTRY;
}

export { KNOWN as KNOWN_COUNTRIES };
