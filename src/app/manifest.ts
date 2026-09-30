import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/** Web app manifest ("Add to Home Screen"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZAPR",
    short_name: "ZAPR",
    description: "The crypto social network on Solana: zap posts with SOL to keep them alive.",
    lang: "en-US",
    start_url: "/",
    display: "standalone",
    background_color: BRAND.ink,
    theme_color: BRAND.ink,
    icons: [
      { src: "/brand/zapr-icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/brand/zapr-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/zapr-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/zapr-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
