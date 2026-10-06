// Browser test of the Google sign-in and of account linking, with a FAKE Privy
// (tests/mocks/): no Google account involved. It drives a real Chromium against
// a dev server; it is not part of `npm test`.
//
//   ZAPR_MOCK_PRIVY=1 NEXT_PUBLIC_PRIVY_APP_ID=cmmockmockmockmockmockmoc \
//     NEXT_PUBLIC_SOCIAL_LOGINS=google npx next dev -p 3100
//   BASE_URL=http://localhost:3100 node tests/browser/link-google.e2e.mjs
//
// Needs a Chromium for playwright-core (`npx playwright install chromium`, or
// PLAYWRIGHT_BROWSERS_PATH / CHROMIUM_PATH pointing to one).
//
// It proves the ZAPR side of the flows. The real Google + Privy part can only
// be checked by hand, on the real site (docs/PRIVY-SETUP.md).
import { chromium } from "playwright-core";
import nacl from "tweetnacl";
import bs58 from "bs58";

const B = process.env.BASE_URL || "http://localhost:3100";
let fails = 0;
const check = (ok, what) => {
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} - ${what}`);
};
const short = (w) => `${w.slice(0, 4)}…${w.slice(-4)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Wallets (Node side) ----------------------------------------------------
const keys = [];
const newKey = () => {
  const kp = nacl.sign.keyPair();
  const k = { kp, address: bs58.encode(kp.publicKey), secret: bs58.encode(kp.secretKey) };
  keys.push(k);
  return k;
};
const secretOf = (address) => keys.find((k) => k.address === address)?.kp.secretKey;

/** A cookie-jar API client: what another browser would do. */
function client() {
  let cookie = "";
  const call = async (path, init = {}) => {
    const r = await fetch(B + path, { ...init, headers: { "content-type": "application/json", cookie } });
    for (const sc of r.headers.getSetCookie()) {
      const kv = sc.split(";")[0];
      const name = kv.split("=")[0];
      cookie = cookie.split("; ").filter((c) => c && !c.startsWith(name + "=")).concat(kv).join("; ");
    }
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const signIn = async (key) => {
    const n = await call(`/api/auth/nonce?wallet=${key.address}`);
    const sig = nacl.sign.detached(new TextEncoder().encode(n.body.message), key.kp.secretKey);
    return call("/api/auth/verify", { method: "POST", body: JSON.stringify({ wallet: key.address, signature: bs58.encode(sig) }) });
  };
  const session = () => cookie.split("; ").find((c) => c.startsWith("zapr_session="))?.slice("zapr_session=".length);
  return { call, signIn, session };
}

/** A ZAPR account created with a Phantom key, and its session cookie. */
async function phantomAccount(prefix) {
  const key = newKey();
  const c = client();
  await c.signIn(key);
  const r = await c.call("/api/users", { method: "POST", body: JSON.stringify({ handle: `${prefix}_${Date.now().toString(36).slice(-5)}` }) });
  return { key, user: r.body.user, session: c.session() };
}

// --- Browser ----------------------------------------------------------------
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const pageErrors = [];

/**
 * A page with: a fake "Phantom" (Wallet Standard, several accounts, switchable
 * with window.__phantomSwitch(address)), the fake Google wallet's key preset
 * (optional), an optional ZAPR session, and a toast recorder.
 */
async function open({ session, phantom = [], privySecret, connectPhantom = false, extra = {} }) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (session) await ctx.addCookies([{ name: "zapr_session", value: session, url: B }]);
  await ctx.exposeFunction("__zsign", (address, bytes) => [...nacl.sign.detached(Uint8Array.from(bytes), secretOf(address))]);
  const toasts = [];
  await ctx.exposeFunction("__toast", (t) => toasts.push(t));
  await ctx.addInitScript(
    ({ accounts, privySecret, connectPhantom, extra }) => {
      localStorage.setItem("zapr_welcomed", "1");
      if (privySecret && !localStorage.getItem("mockprivy_secret")) localStorage.setItem("mockprivy_secret", privySecret);
      if (connectPhantom && !sessionStorage.getItem("__init")) {
        localStorage.setItem("zapr_logged_in", "1");
        localStorage.setItem("walletName", JSON.stringify("Phantom"));
      }
      for (const [k, v] of Object.entries(extra)) if (!sessionStorage.getItem("__init")) localStorage.setItem(k, v);
      sessionStorage.setItem("__init", "1");
      // Fake Phantom.
      const listeners = [];
      let cur = Number(sessionStorage.getItem("__phantomCur") || 0);
      const acct = (a) => ({ address: a.address, publicKey: new Uint8Array(a.pub), chains: ["solana:devnet"], features: ["solana:signMessage"] });
      const w = {
        version: "1.0.0",
        name: "Phantom",
        chains: ["solana:devnet", "solana:mainnet"],
        icon: "data:image/svg+xml;base64," + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#ab9ff2"/></svg>'),
        accounts: [],
        features: {
          "standard:connect": { version: "1.0.0", connect: async () => ((w.accounts = accounts.length ? [acct(accounts[cur])] : []), { accounts: w.accounts }) },
          "standard:disconnect": { version: "1.0.0", disconnect: async () => { w.accounts = []; } },
          "standard:events": { version: "1.0.0", on: (_e, fn) => (listeners.push(fn), () => {}) },
          "solana:signMessage": {
            version: "1.0.0",
            signMessage: async (...inputs) =>
              Promise.all(inputs.map(async ({ account, message }) => ({ signedMessage: message, signature: new Uint8Array(await window.__zsign(account.address, [...message])) }))),
          },
          "solana:signTransaction": { version: "1.0.0", supportedTransactionVersions: ["legacy", 0], signTransaction: async () => { throw new Error("no tx"); } },
        },
      };
      window.__phantomSwitch = (address) => {
        cur = accounts.findIndex((a) => a.address === address);
        sessionStorage.setItem("__phantomCur", String(cur));
        if (w.accounts.length) {
          w.accounts = [acct(accounts[cur])];
          listeners.forEach((fn) => fn({ accounts: w.accounts }));
        }
      };
      if (accounts.length) {
        const register = ({ register }) => register(w);
        window.addEventListener("wallet-standard:app-ready", (e) => register(e.detail));
        try {
          window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: register }));
        } catch {}
      }
      // Toasts.
      document.addEventListener("DOMContentLoaded", () => {
        let last = "";
        new MutationObserver(() => {
          const t = document.querySelector(".toast")?.textContent || "";
          if (t && t !== last) {
            last = t;
            window.__toast(t);
          }
        }).observe(document.body, { subtree: true, childList: true, characterData: true });
      });
    },
    { accounts: phantom.map((k) => ({ address: k.address, pub: [...k.kp.publicKey] })), privySecret, connectPhantom, extra },
  );
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  if (process.env.E2E_DEBUG) page.on("console", (m) => console.log("   [console]", m.type(), m.text().slice(0, 300)));
  const me = () => page.evaluate(() => fetch("/api/auth/me").then((r) => r.json()));
  const btn = async () => (await page.locator(".tb-actions .btn").last().innerText()).trim();
  const waitToast = async (re, ms = 20000) => {
    for (let t = 0; t < ms; t += 250) {
      if (toasts.some((x) => re.test(x))) return true;
      await sleep(250);
    }
    return false;
  };
  const settled = async () => {
    await page.waitForFunction(() => !document.querySelector(".zapr-loader"), null, { timeout: 60000 }).catch(() => {});
    await sleep(1500);
  };
  const openLink = async () => {
    await page.goto(B + "/settings", { timeout: 90000 });
    await page.locator(".settings-row", { hasText: "Link a wallet" }).click({ timeout: 60000 });
    await page.locator(".modal").waitFor();
  };
  return { ctx, page, toasts, me, btn, waitToast, settled, openLink };
}

// ============================================================================
// A. Sign up with Google (fake), then B. that Google account links Phantom.
// ============================================================================
const pA = newKey();
const A = await open({ phantom: [pA] });
await A.page.goto(B + "/", { timeout: 90000 });
await A.settled();
await A.page.locator(".tb-actions .btn").last().click();
await A.page.getByRole("button", { name: "Continue with Google" }).click();
// The fake "trip to Google" reloads the page; ZAPR then signs in with the Google wallet.
await A.page.getByPlaceholder("e.g. satoshi_fan").waitFor({ timeout: 120000 });
const googleA = await A.page.evaluate(() => localStorage.getItem("mockprivy_secret"));
const googleAKey = (() => {
  const kp = nacl.sign.keyPair.fromSecretKey(bs58.decode(googleA));
  const k = { kp, address: bs58.encode(kp.publicKey), secret: googleA };
  keys.push(k);
  return k;
})();
const handleA = `gg_${Date.now().toString(36).slice(-5)}`;
await A.page.getByPlaceholder("e.g. satoshi_fan").fill(handleA);
await A.page.getByRole("button", { name: "Enter the arena" }).click();
check(await A.waitToast(/Welcome/), "A. Google sign-up: asked for a username, account created");
let m = await A.me();
check(m.user?.wallet === googleAKey.address, "A. the account's main wallet is the Google wallet");
check((await A.page.evaluate(() => localStorage.getItem("mockprivy_haswallet"))) === "1", "A. ZAPR asked Privy to create the Solana wallet");
const userA = m.user;

// B. Google user links Phantom.
await A.openLink();
check(!(await A.page.getByRole("button", { name: "Link Google" }).isVisible()), "B. no 'Link Google' while using the Google wallet");
await A.page.locator(".modal .wallet-option", { hasText: "Phantom" }).click();
check(await A.waitToast(/Wallet linked/), "B. Phantom linked to the Google account");
m = await A.me();
check(m.user?.linkedWallets?.map((w) => w.wallet).join() === pA.address, "B. server: Phantom is a linked wallet");
check((await client().signIn(pA)).body.user?.id === userA.id, "B. signing in with Phantom opens the same account");
// Google is the main wallet: "Link Google" from Phantom says it's already there.
await A.openLink();
await A.page.getByRole("button", { name: "Link Google" }).click();
check(await A.waitToast(/already on this account/), "B. 'Link Google' again: already on this account");
if (process.env.E2E_DEBUG) console.log("   toasts", A.toasts, await A.page.evaluate(() => JSON.stringify({ ss: { ...sessionStorage }, wn: localStorage.getItem("walletName"), auth: localStorage.getItem("mockprivy_auth") })));
check((await A.me()).user?.linkedWallets?.length === 1, "B. nothing duplicated");

// ============================================================================
// C. Phantom user links Google (fake trip to Google and back).
// ============================================================================
const C0 = await phantomAccount("ph");
const C = await open({ session: C0.session, phantom: [C0.key], connectPhantom: true });
await C.openLink();
await C.page.getByRole("button", { name: "Link Google" }).click();
check(await C.waitToast(/Wallet linked/, 60000), "C. back from Google: Google wallet linked");
m = await C.me();
const googleC = await C.page.evaluate(() => localStorage.getItem("mockprivy_secret"));
const googleCAddr = bs58.encode(nacl.sign.keyPair.fromSecretKey(bs58.decode(googleC)).publicKey);
check(m.user?.id === C0.user.id && m.user.linkedWallets?.[0]?.wallet === googleCAddr && m.user.linkedWallets[0].label === "Privy", "C. server: the Google wallet is linked (label Privy)");
check(m.user?.wallet === C0.key.address, "C. Phantom stays the main wallet (receives the zaps)");
check((await C.page.evaluate(() => sessionStorage.getItem("zapr_linking"))) === null, "C. linking mode is over");
await C.page.goto(B + "/settings");
check(
  await C.page.locator(".settings-row", { hasText: "Google wallet" }).waitFor({ timeout: 60000 }).then(() => true, () => false),
  "C. Settings lists the Google wallet",
);

// ============================================================================
// E. A Google wallet that already has its own account (A's) can't be linked.
// ============================================================================
const E0 = await phantomAccount("ph");
const E = await open({ session: E0.session, phantom: [E0.key], connectPhantom: true, privySecret: googleA });
await E.openLink();
await E.page.getByRole("button", { name: "Link Google" }).click();
check(await E.waitToast(/already has its own ZAPR account/, 60000), "E. Google wallet with its own account: refused");
await sleep(3000);
m = await E.me();
check(m.user?.id === E0.user.id && (m.user.linkedWallets ?? []).length === 0, "E. still signed in to the Phantom account, nothing linked");
check((await E.btn()) === short(E0.key.address), `E. back on Phantom (${await E.btn()})`);
check((await E.page.evaluate(() => localStorage.getItem("mockprivy_auth"))) === null, "E. the Google session was ended");

// ============================================================================
// F. Google cancelled: back on ZAPR, a Phantom account switch is NOT linked.
// ============================================================================
const F0 = await phantomAccount("ph");
const stranger = newKey();
const F = await open({ session: F0.session, phantom: [F0.key, stranger], connectPhantom: true, extra: { mockprivy_cancel: "1" } });
await F.openLink();
await F.page.getByRole("button", { name: "Link Google" }).click();
await F.page.waitForLoadState("load");
await F.settled();
await F.page.evaluate((a) => window.__phantomSwitch(a), stranger.address);
await sleep(4000);
check(!F.toasts.some((t) => /linked/i.test(t)), "F. after a cancelled Google trip, switching Phantom account doesn't link it");
m = await F.me();
check(m.user === null, "F. switching to another Phantom account signs out, as usual");
check((await client().signIn(stranger)).body.needsOnboarding === true, "F. that other account stays independent");

// ============================================================================
// G. The ZAPR session ended during the trip to Google: nothing is linked.
// ============================================================================
const G0 = await phantomAccount("ph");
const G = await open({ session: G0.session, phantom: [G0.key], connectPhantom: true, extra: { mockprivy_manual: "1" } });
await G.openLink();
await G.page.getByRole("button", { name: "Link Google" }).click();
await sleep(500);
await G.ctx.clearCookies();
await G.page.reload();
check(await G.waitToast(/Sign in to ZAPR first/, 60000), "G. session gone on return: asks to sign in first");
check((await G.page.evaluate(() => localStorage.getItem("mockprivy_auth"))) === null, "G. the Google session was ended");

// ============================================================================
// H. Privy can't create the wallet: a clear message, no endless wait.
// ============================================================================
const H = await open({ extra: { mockprivy_create_fails: "1" } });
await H.page.goto(B + "/", { timeout: 90000 });
await H.settled();
await H.page.locator(".tb-actions .btn").last().click();
await H.page.getByRole("button", { name: "Continue with Google" }).click();
check(await H.waitToast(/Couldn't create your wallet/, 60000), "H. wallet creation fails: clear message");
check((await H.me()).user === null, "H. not signed in");

await browser.close();
check(pageErrors.length === 0, `no page errors${pageErrors.length ? ": " + pageErrors.join(" | ") : ""}`);
console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
