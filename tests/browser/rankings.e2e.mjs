// Browser test of the leaderboard rules: a zap counts for its full amount
// (100 %), a self-zap counts like any other zap (no badge), and the /admin
// rankings check. Not part of `npm test`. Run against a dev server on a
// FRESH demo store, with on-chain checks off (the default in development):
//
//   ZAPR_DATA_DIR=$(mktemp -d) NEXT_PUBLIC_FOUNDER_WALLET=<printed below> npx next dev -p 3100
//   BASE_URL=http://localhost:3100 FOUNDER_SECRET=<printed below> node tests/browser/rankings.e2e.mjs
//
// (Run it once without FOUNDER_SECRET: it prints a founder key pair to use.)
import { chromium } from "playwright-core";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { randomUUID } from "node:crypto";

const B = process.env.BASE_URL || "http://localhost:3100";
if (!process.env.FOUNDER_SECRET) {
  const kp = nacl.sign.keyPair();
  console.log(`NEXT_PUBLIC_FOUNDER_WALLET=${bs58.encode(kp.publicKey)}\nFOUNDER_SECRET=${bs58.encode(kp.secretKey)}`);
  process.exit(2);
}
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
    if (v.body.user) return v.body.user;
    return (await call("/api/users", { method: "POST", body: JSON.stringify({ handle }) })).body.user;
  };
  const session = () => cookie.split("; ").find((c) => c.startsWith("zapr_session="))?.slice("zapr_session=".length);
  return { call, signUp, session };
}

const tag = Date.now().toString(36).slice(-4);
const alice = client(nacl.sign.keyPair());
const bob = client(nacl.sign.keyPair());
const founder = client(nacl.sign.keyPair.fromSecretKey(bs58.decode(process.env.FOUNDER_SECRET)));
const aliceUser = await alice.signUp(`alice_${tag}`);
if (!aliceUser) throw new Error("couldn't sign up (is the server up?)");
await bob.signUp(`bob_${tag}`);
await founder.signUp(`founder_${tag}`);

const created = await alice.call("/api/posts", { method: "POST", body: JSON.stringify({ text: `Rank test ${tag}` }) });
if (!created.body.post) throw new Error(`couldn't create the post: ${created.status} ${JSON.stringify(created.body)}`);
const post = created.body.post;
const zap = (c, amount) =>
  c.call(`/api/posts/${post.id}/pump`, { method: "POST", body: JSON.stringify({ amount, signature: `e2e-${randomUUID()}`, anonymous: false }) });
check((await zap(bob, 100)).status === 200, "bob zaps 100 SOL (recorded)");
check((await zap(alice, 500)).status === 200, "alice zaps her own post 500 SOL (allowed, like any zap)");
const direct = await bob.call(`/api/users/${aliceUser.handle}/zap`, {
  method: "POST",
  body: JSON.stringify({ amount: 50, signature: `e2e-${randomUUID()}`, anonymous: false }),
});
check(direct.status === 200, "bob zaps alice directly 50 SOL");
const self = await alice.call(`/api/users/${aliceUser.handle}/zap`, {
  method: "POST",
  body: JSON.stringify({ amount: 5, signature: `e2e-${randomUUID()}`, anonymous: false }),
});
check(self.status === 400, "a direct zap to yourself is refused");

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(() => localStorage.setItem("zapr_welcomed", "1"));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

// Posts board: 600 SOL (bob's 100 + alice's own 500, both in full), not 70 + 350 (creator shares).
await page.goto(B + "/leaderboard", { timeout: 120000 });
const first = page.locator(".lb-row").first();
await first.waitFor({ timeout: 60000 });
const firstText = (await first.innerText()).replace(/\s+/g, " ");
check(firstText.includes(`Rank test ${tag}`) && /\b600\b/.test(firstText), `posts board: "${firstText}"`);

// Creators board: 650 SOL zapped (100 + 500 on her post + 50 direct).
await page.locator(".tab", { hasText: "Creators" }).first().click();
await page.locator(".lb-row", { hasText: aliceUser.handle }).first().waitFor({ timeout: 30000 });
const aRow = (await page.locator(".lb-row", { hasText: aliceUser.handle }).first().innerText()).replace(/\s+/g, " ");
check(/\b650\b/.test(aRow) && aRow.includes("SOL zapped"), `creators board: "${aRow}"`);
check((await page.locator(".lb-row").first().innerText()).includes(aliceUser.handle), "alice is first among creators");

// The post keeps every zap (life); the self-zap shows like any zap: no badge, no flag.
const detail = (await alice.call(`/api/posts/${post.id}`)).body;
check(Math.abs(detail.post.pumped - 600) < 1e-9, `the post's total keeps every zap (${detail.post.pumped} SOL)`);
check(detail.pumpers.every((pp) => !("isSelfPump" in pp)), "the API no longer flags self-zaps");
await page.goto(B + `/post/${post.id}`);
await page.locator(".pr-name").first().waitFor({ timeout: 60000 });
check((await page.getByText("self-zap", { exact: true }).count()) === 0, "no self-zap badge on the post page");

// /admin rankings check (founder only).
await ctx.addCookies([{ name: "zapr_session", value: founder.session(), url: B }]);
await page.goto(B + "/admin");
const checkEl = page.locator(".admin-check", { hasText: "Rankings check" });
await checkEl.waitFor({ timeout: 60000 });
const checkText = (await checkEl.innerText()).replace(/\s+/g, " ");
check(checkText.includes("every zap is tied to its creator") && checkText.includes("self-zaps included"), `admin: "${checkText}"`);
if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/admin-check.png` });

await browser.close();
check(errors.length === 0, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
