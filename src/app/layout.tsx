import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

const DESCRIPTION =
  "Le réseau social crypto sur Solana : envoie des zaps en SOL pour faire vivre les posts.";

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
  openGraph: { type: "website", siteName: "ZAPR", title: "ZAPR", description: DESCRIPTION, locale: "fr_FR" },
  twitter: { card: "summary_large_image", title: "ZAPR", description: DESCRIPTION },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0b",
};

// Set the theme before paint to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('zapr_theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
