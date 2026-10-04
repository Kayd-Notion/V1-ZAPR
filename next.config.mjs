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
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "frame-src 'none'",
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
  async headers() {
    // Dev server: no CSP (hot reload uses eval and websockets on localhost).
    const headers = process.env.NODE_ENV === "production" ? securityHeaders : securityHeaders.slice(1);
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
