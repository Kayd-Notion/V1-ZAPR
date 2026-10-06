import { fileURLToPath } from "node:url";
/**
 * Security headers on every page and API answer.
 *
 * The Content-Security-Policy only lets scripts, styles and fonts come from
 * ZAPR itself (no third-party script can be injected), forbids embedding ZAPR
 * in another site (clickjacking) and plugins. Scripts keep 'unsafe-inline'
 * (Next.js inline bootstrapping, theme script) and 'unsafe-eval' (crypto
 * polyfills used by the wallet / Arweave libraries); tightening them needs
 * nonces. Network calls stay open to https/wss: Solana RPCs, Irys and Arweave
 * gateways change with the configuration.
 */
// Google / Apple sign-in (Privy): its secure wallet runs in an iframe from
// auth.privy.io, and its bot check may load Cloudflare Turnstile.
const PRIVY_FRAMES = "https://auth.privy.io https://*.privy.io https://challenges.cloudflare.com https://verify.walletconnect.com https://verify.walletconnect.org";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  `frame-src 'self' ${PRIVY_FRAMES}`,
  `child-src 'self' ${PRIVY_FRAMES}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Read at runtime by the Postgres store to create the tables on first use.
  outputFileTracingIncludes: { "/**": ["./src/db/schema.sql"] },
  images: {
    // Media is served from Arweave gateways.
    remotePatterns: [
      { protocol: "https", hostname: "arweave.net" },
      { protocol: "https", hostname: "gateway.irys.xyz" },
      { protocol: "https", hostname: "**.arweave.net" },
    ],
  },
  webpack(config, { dev }) {
    // Privy optionally imports the Farcaster mini-app SDK; ZAPR doesn't use it.
    config.resolve.alias = { ...config.resolve.alias, "@farcaster/mini-app-solana": false };
    // Browser test only (tests/browser/link-google.e2e.mjs): a fake Privy, so the
    // Google flows run without a Google account. Dev server + ZAPR_MOCK_PRIVY=1
    // only; a production build never includes it.
    if (dev && process.env.ZAPR_MOCK_PRIVY === "1") {
      const mock = (f) => fileURLToPath(new URL(`./tests/mocks/${f}`, import.meta.url));
      config.resolve.alias["@privy-io/react-auth/solana$"] = mock("privy-solana.ts");
      config.resolve.alias["@privy-io/react-auth$"] = mock("privy-react-auth.tsx");
    }
    return config;
  },
  async headers() {
    // Dev server: no CSP (hot reload uses eval and websockets on localhost).
    const headers = process.env.NODE_ENV === "production" ? securityHeaders : securityHeaders.slice(1);
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
