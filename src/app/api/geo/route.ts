import { NextRequest, NextResponse } from "next/server";
import { countryFromRequest } from "@/lib/geo";

export const runtime = "nodejs";

/** The requester's country, derived live from IP (never stored). */
export async function GET(req: NextRequest) {
  return NextResponse.json({ country: countryFromRequest(req) });
}
