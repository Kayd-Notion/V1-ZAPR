import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { BRAND, LIGHT_MODE_ENABLED } from "@/lib/brand";

// Self-hosted fonts (src/app/fonts): no Google Fonts / CDN request at runtime.
// Each one fills a CSS variable read by the font tokens in globals.css.
const inter = localFont({
  src: "./fonts/Inter-latin-var.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});
const chakra = localFont({
  src: [
    { path: "./fonts/ChakraPetch-latin-500.woff2", weight: "500" },
    { path: "./fonts/ChakraPetch-latin-600.woff2", weight: "600" },
    { path: "./fonts/ChakraPetch-latin-700.woff2", weight: "700" },
  ],
  variable: "--font-chakra",
  display: "swap",
});
const jetbrains = localFont({
  src: "./fonts/JetBrainsMono-latin-var.woff2",
  weight: "100 800",
  variable: "--font-jetbrains",
  display: "swap",
});

const DESCRIPTION =
  "The crypto social network on Solana: zap posts with SOL to keep them alive.";

// Public address of the site, used for absolute links in social previews.
// Set NEXT_PUBLIC_SITE_URL once ZAPR has its own domain; until then, the
// Vercel production URL (provided by Vercel at build time).
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "ZAPR", template: "%s · ZAPR" },
  description: DESCRIPTION,
  applicationName: "ZAPR",
  openGraph: { type: "website", siteName: "ZAPR", title: "ZAPR", description: DESCRIPTION, locale: "en_US" },
  twitter: { card: "summary_large_image", title: "ZAPR", description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: BRAND.night,
};

// Set the theme before paint to avoid a flash of the wrong theme.
// Also mark visitors (data-auth="guest") so every bolt starts grey without a
// yellow flash; AppShell corrects it once the session is known.
// Dark-only unless LIGHT_MODE_ENABLED: a saved "light" choice is then ignored.
const themeScript = `(function(){var d=document.documentElement;try{var t=${LIGHT_MODE_ENABLED ? "localStorage.getItem('zapr_theme')" : "'dark'"};d.setAttribute('data-theme',t==='light'?'light':'dark');d.setAttribute('data-auth',localStorage.getItem('zapr_logged_in')==='1'?'in':'guest');}catch(e){d.setAttribute('data-theme','dark');d.setAttribute('data-auth','guest');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${chakra.variable} ${jetbrains.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
