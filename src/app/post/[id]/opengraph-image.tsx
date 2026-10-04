import { ImageResponse } from "next/og";
import { getStore } from "@/lib/db";
import { lifespanInfo } from "@/lib/lifespan";
import { fmtSol, remainingLabel } from "@/lib/format";
import { BRAND } from "@/lib/brand";

export const runtime = "nodejs";
export const alt = "A post on ZAPR";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BOLT = "M356 82 201 182l46 9-114 138 79 3-53 110 202-168-81-16 38-51 42 37z";
const YELLOW = BRAND.yellow;

/** Emoji have no glyph in the built-in font: leave them out of the picture. */
function clean(text: string, max: number): string {
  const t = text.replace(/\p{Extended_Pictographic}|️|‍/gu, "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

function Bolt({ size: s }: { size: number }) {
  return (
    <svg width={s} height={s} viewBox="120 70 290 380">
      <path d={BOLT} fill={YELLOW} />
    </svg>
  );
}

/** The share picture of a post: who, what, how much zapped, how long left. */
export default async function PostImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getStore()
    .getPost(id)
    .catch(() => null);

  const frame = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between",
    padding: "64px 72px",
    background: BRAND.night,
    color: "#ffffff",
    fontSize: 32,
  };

  if (!post) {
    return new ImageResponse(
      (
        <div style={{ ...frame, alignItems: "center", justifyContent: "center", gap: 24 }}>
          <Bolt size={140} />
          <div style={{ fontSize: 56, fontWeight: 700 }}>This post zapped out.</div>
          <div style={{ color: "#a1a1aa" }}>ZAPR · Post. Get zapped. Stay alive.</div>
        </div>
      ),
      size,
    );
  }

  const info = lifespanInfo(post.createdAt, post.pumped);
  const text = clean(post.text, 180) || "A post on ZAPR";
  const long = text.length > 90;

  return new ImageResponse(
    (
      <div style={frame}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Bolt size={56} />
            <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 2 }}>ZAPR</div>
          </div>
          <div style={{ fontSize: 30, color: "#a1a1aa" }}>{`@${post.author.handle}`}</div>
        </div>

        <div style={{ display: "flex", fontSize: long ? 46 : 60, fontWeight: 700, lineHeight: 1.2 }}>{text}</div>

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 26px",
              background: YELLOW,
              color: "#111111",
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            {`${fmtSol(post.pumped)} SOL zapped`}
          </div>
          <div style={{ fontSize: 32, color: info.cls === "critical" ? "#ff4d3d" : "#d4d4d8" }}>
            {remainingLabel(info.remainingMs)}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
