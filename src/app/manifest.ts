import type { MetadataRoute } from "next";

/** Web app manifest ("Ajouter à l'écran d'accueil"). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZAPR",
    short_name: "ZAPR",
    description: "Le réseau social crypto sur Solana : envoie des zaps en SOL pour faire vivre les posts.",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    icons: [
      { src: "/brand/zapr-icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/brand/zapr-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/zapr-icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/zapr-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
