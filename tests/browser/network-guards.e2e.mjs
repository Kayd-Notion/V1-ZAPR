// Browser test of the network safety guards (Lot 4). Not part of `npm test`.
//
// Part 1, "wrong RPC": the site is on devnet but its RPC answers like MAINNET
// (fake RPCs started by this test: https://127.0.0.1:8999 for the browser, with
// a self-signed certificate made by openssl, and http://127.0.0.1:8998 for the
// server). A zap must be refused before the wallet signs, and /admin must show
// the network in red.
//   NEXT_PUBLIC_SOLANA_RPC=https://127.0.0.1:8999 NEXT_PUBLIC_FOUNDER_WALLET=<founder> \
//   NEXT_PUBLIC_CONTACT_EMAIL=beta@example.com npx next build
//   SOLANA_RPC_URL=http://127.0.0.1:8998 ZAPR_DATA_DIR=$(mktemp -d) npx next start -p 3100
//   PART=rpc BASE_URL=http://localhost:3100 FOUNDER_SECRET=<founder secret> node tests/browser/network-guards.e2e.mjs
//
// Part 2, "mainnet": a build with NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta and no
// contact e-mail. Every zap API refuses, the zap button is off, and the legal
// pages show the contact placeholder.
//   NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta npx next build && ZAPR_DATA_DIR=$(mktemp -d) npx next start -p 3100
//   PART=mainnet BASE_URL=http://localhost:3100 node tests/browser/network-guards.e2e.mjs
import http from "node:http";
import https from "node:https";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import nacl from "tweetnacl";
import bs58 from "bs58";

const B = process.env.BASE_URL || "http://localhost:3100";
const PART = process.env.PART || "rpc";
const MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
let fails = 0;
const check = (ok, what) => {
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} - ${what}`);
};

function client(kp) {
  let cookie = "";
  const address = bs58.encode(kp.publicKey);
  const call = async (path, init = {}) => {
    const r = await fetch(B + path, { ...init, headers: { "content-type": "application/json", cookie } });
    for (const sc of r.headers.getSetCookie()) {
      const kv = sc.split(";")[0];
      const name = kv.split("=")[0];
      cookie = cookie.split("; ").filter((c) => c && !c.startsWith(name + "=")).concat(kv).join("; ");
    }
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const signUp = async (handle) => {
    const n = await call(`/api/auth/nonce?wallet=${address}`);
    const sig = bs58.encode(nacl.sign.detached(new TextEncoder().encode(n.body.message), kp.secretKey));
    const v = await call("/api/auth/verify", { method: "POST", body: JSON.stringify({ wallet: address, signature: sig }) });
    return v.body.user ?? (await call("/api/users", { method: "POST", body: JSON.stringify({ handle }) })).body.user;
  };
  const session = () => cookie.split("; ").find((c) => c.startsWith("zapr_session="))?.slice("zapr_session=".length);
  return { call, signUp, session, address };
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const tag = Date.now().toString(36).slice(-4);

if (PART === "rpc") {
  // A fake RPC that says it is mainnet (and answers the rest minimally).
  const rpcCalls = [];
  const handler = (req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-headers", "*");
      if (req.method === "OPTIONS") return res.end();
      const msg = JSON.parse(body || "{}");
      const one = (m) => {
        rpcCalls.push(m.method);
        const result =
          m.method === "getGenesisHash"
            ? MAINNET_GENESIS
            : m.method === "getBalance"
              ? { context: { slot: 1 }, value: 2_000_000_000 }
              : m.method === "getLatestBlockhash"
                ? { context: { slot: 1 }, value: { blockhash: "11111111111111111111111111111111", lastValidBlockHeight: 10 } }
                : null;
        return { jsonrpc: "2.0", id: m.id, result };
      };
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify(Array.isArray(msg) ? msg.map(one) : one(msg)));
    });
  };
  const dir = mkdtempSync(path.join(os.tmpdir(), "zapr-rpc-"));
  execSync(
    `openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=127.0.0.1 -keyout ${dir}/k.pem -out ${dir}/c.pem`,
    { stdio: "ignore" },
  );
  const rpc = https.createServer({ key: readFileSync(`${dir}/k.pem`), cert: readFileSync(`${dir}/c.pem`) }, handler);
  const serverRpc = http.createServer(handler);
  await new Promise((r) => rpc.listen(8999, "127.0.0.1", r));
  await new Promise((r) => serverRpc.listen(8998, "127.0.0.1", r));

  const founder = client(nacl.sign.keyPair.fromSecretKey(bs58.decode(process.env.FOUNDER_SECRET)));
  await founder.signUp(`founder_${tag}`);
  const zapperKp = nacl.sign.keyPair();
  const zapper = client(zapperKp);
  await zapper.signUp(`zapper_${tag}`);

  // The zapper tries to zap a post with a wallet that really signs.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ignoreHTTPSErrors: true });
  await ctx.addCookies([{ name: "zapr_session", value: zapper.session(), url: B }]);
  let signed = 0;
  await ctx.exposeFunction("__signed", () => signed++);
  await ctx.addInitScript(
    ({ address, pub }) => {
      localStorage.setItem("zapr_welcomed", "1");
      localStorage.setItem("zapr_logged_in", "1");
      localStorage.setItem("walletName", JSON.stringify("Phantom"));
      const acct = { address, publicKey: new Uint8Array(pub), chains: ["solana:devnet"], features: ["solana:signTransaction"] };
      const w = {
        version: "1.0.0", name: "Phantom", chains: ["solana:devnet", "solana:mainnet"],
        icon: "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/>'),
        accounts: [],
        features: {
          "standard:connect": { version: "1.0.0", connect: async () => ((w.accounts = [acct]), { accounts: w.accounts }) },
          "standard:disconnect": { version: "1.0.0", disconnect: async () => { w.accounts = []; } },
          "standard:events": { version: "1.0.0", on: () => () => {} },
          "solana:signMessage": { version: "1.0.0", signMessage: async () => { throw new Error("no"); } },
          "solana:signTransaction": { version: "1.0.0", supportedTransactionVersions: ["legacy", 0], signTransaction: async () => { await window.__signed(); throw new Error("signed (test)"); } },
        },
      };
      const register = ({ register }) => register(w);
      window.addEventListener("wallet-standard:app-ready", (e) => register(e.detail));
      try { window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: register })); } catch {}
      document.addEventListener("DOMContentLoaded", () => {
        new MutationObserver(() => {
          const t = document.querySelector(".toast")?.textContent;
          if (t) window.__lastToast = t;
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
      });
    },
    { address: zapper.address, pub: [...zapperKp.publicKey] },
  );
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(B + "/post/p1");
  await p.waitForTimeout(3000);
  await p.locator(".pump-btn").first().click();
  await p.locator(".modal").waitFor();
  await p.locator(".modal .btn-primary, .modal .pump-btn").last().click();
  await p.waitForTimeout(4000);
  const msg = (await p.evaluate(() => window.__lastToast || document.querySelector(".modal")?.textContent || "")) || "";
  check(/Zaps are paused/.test(msg) && /not on devnet/.test(msg), `zap refused before signing: "${msg.slice(0, 140)}"`);
  check(signed === 0, "the wallet was never asked to sign");
  check(rpcCalls.includes("getGenesisHash") && !rpcCalls.includes("sendTransaction"), `RPC calls: ${[...new Set(rpcCalls)].join(", ")}`);
  await ctx.close();

  // The server refuses to verify a zap against a wrong-network RPC (it would say so if verification is on).
  // /admin: network line in red, security check present, nothing secret shown.
  const actx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await actx.addCookies([{ name: "zapr_session", value: founder.session(), url: B }]);
  await actx.addInitScript(() => localStorage.setItem("zapr_welcomed", "1"));
  const a = await actx.newPage();
  await a.goto(B + "/admin");
  await a.locator(".admin-check").first().waitFor({ timeout: 60000 });
  const checks = (await a.locator(".admin-check").allInnerTexts()).map((t) => t.replace(/\s+/g, " "));
  const net = checks.find((t) => t.startsWith("Network:")) || "";
  const sec = checks.find((t) => t.startsWith("Security check:")) || "";
  check(/browser RPC 127\.0\.0\.1:8999 · server RPC 127\.0\.0\.1:8998 is on ANOTHER network/.test(net), `admin network: "${net}"`);
  check(sec.length > 0, `admin security: "${sec.slice(0, 160)}…"`);
  check(!checks.join(" ").includes(process.env.FOUNDER_SECRET), "no secret on the admin page");
  if (process.env.SHOTS) await a.screenshot({ path: `${process.env.SHOTS}/admin-guards.png` });

  // Legal pages: the contact e-mail is a link.
  await a.goto(B + "/terms");
  const contact = a.locator('a[href^="mailto:"]', { hasText: "beta@example.com" });
  check((await contact.count()) > 0, "Terms show the contact e-mail");
  await actx.close();
  rpc.close();
  serverRpc.close();
} else {
  // Mainnet build: every zap API refuses; the UI keeps zaps off; contact placeholder visible.
  const u = client(nacl.sign.keyPair());
  await u.signUp(`mn_${tag}`);
  const r1 = await u.call("/api/posts/p1/pump/prepare", { method: "POST", body: JSON.stringify({ amount: 0.1 }) });
  const r2 = await u.call("/api/posts/p1/pump", { method: "POST", body: JSON.stringify({ amount: 0.1, signature: "x" }) });
  const r3 = await u.call("/api/posts/p1/pump-quote");
  const r4 = await u.call("/api/users/devSol/zap/prepare", { method: "POST", body: JSON.stringify({ amount: 0.1 }) });
  const r5 = await u.call("/api/users/devSol/zap", { method: "POST", body: JSON.stringify({ amount: 0.1, signature: "x" }) });
  const all = [r1, r2, r3, r4, r5];
  check(all.every((r) => r.status === 403 && r.body.code === "mainnet_disabled"), `zap APIs refuse on mainnet: ${all.map((r) => r.status).join(", ")}`);

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies([{ name: "zapr_session", value: u.session(), url: B }]);
  await ctx.addInitScript(() => localStorage.setItem("zapr_welcomed", "1"));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(B + "/post/p1");
  await p.waitForTimeout(2500);
  check((await p.locator(".net-badge").innerText()).toLowerCase().includes("mainnet"), "the network badge says mainnet");
  await p.locator(".pump-btn").first().click();
  await p.locator(".modal").waitFor();
  const modal = await p.locator(".modal").innerText();
  check(/Zaps are disabled on mainnet/.test(modal), "the zap window says zaps are disabled");
  check(await p.locator(".modal button:disabled").count() > 0, "the send button is off");
  for (const page of ["/terms", "/privacy", "/risks"]) {
    await p.goto(B + page);
    const ph = await p.locator(".legal-placeholder").first().innerText().catch(() => "");
    check(/PLACEHOLDER: contact e-mail/.test(ph), `${page}: contact placeholder clearly marked`);
  }
  if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/legal-placeholder.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
check(errors.length === 0, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
