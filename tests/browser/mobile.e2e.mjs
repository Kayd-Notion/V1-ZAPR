// Phone layout check (iPhone 13 and iPhone SE sizes, plus a short screen as
// when the keyboard is open), and the Feedback window. Not part of `npm test`.
//
//   NEXT_PUBLIC_FEEDBACK_URL=https://forms.gle/test NEXT_PUBLIC_CONTACT_EMAIL=beta@example.com \
//     npx next build && ZAPR_DATA_DIR=$(mktemp -d) npx next start -p 3100
//   BASE_URL=http://localhost:3100 node tests/browser/mobile.e2e.mjs
import { chromium, devices } from "playwright-core";

const B = process.env.BASE_URL || "http://localhost:3100";
let fails = 0;
const check = (ok, what) => {
  if (!ok) fails++;
  console.log(`${ok ? "ok  " : "FAIL"} - ${what}`);
};

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const sizes = [
  ["iPhone 13", devices["iPhone 13"]],
  ["iPhone SE", devices["iPhone SE"]],
];
const pages = ["/", "/post/p1", "/leaderboard", "/live", "/explore", "/wallet", "/profile/devSol", "/how-it-works", "/terms", "/privacy", "/risks"];

for (const [name, device] of sizes) {
  const ctx = await browser.newContext(device);
  await ctx.addInitScript(() => localStorage.setItem("zapr_welcomed", "1"));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  const wide = [];
  for (const path of pages) {
    await p.goto(B + path, { waitUntil: "domcontentloaded", timeout: 120000 });
    await p.waitForTimeout(1500);
    const w = await p.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: window.innerWidth }));
    if (w.doc > w.view) wide.push(`${path} (${w.doc}px > ${w.view}px)`);
  }
  check(wide.length === 0, `${name}: no page scrolls sideways${wide.length ? ": " + wide.join(", ") : ""}`);

  // The last post can scroll clear of the + button.
  await p.goto(B + "/", { waitUntil: "domcontentloaded" });
  await p.locator(".post").first().waitFor({ timeout: 60000 });
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(800);
  const clear = await p.evaluate(() => {
    const posts = [...document.querySelectorAll(".post")];
    const last = posts[posts.length - 1]?.getBoundingClientRect();
    const fab = document.querySelector(".fab")?.getBoundingClientRect();
    return last && fab ? last.bottom <= fab.top + 1 : true;
  });
  check(clear, `${name}: at the bottom of the feed, the last post is above the + button`);

  // Small touch targets in a post's action row.
  const small = await p.evaluate(() =>
    [...document.querySelectorAll(".post-actions .pa-btn, .post-actions .pump-btn")]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width && (r.height < 34 || r.width < 34)).length,
  );
  check(small === 0, `${name}: post buttons are at least 34px`);
  await ctx.close();
}

// Windows fit a short screen (keyboard open): they scroll instead of hiding buttons.
const kbd = await browser.newContext({ ...devices["iPhone 13"], viewport: { width: 390, height: 420 } });
await kbd.addInitScript(() => localStorage.setItem("zapr_welcomed", "1"));
const k = await kbd.newPage();
await k.goto(B + "/", { waitUntil: "domcontentloaded" });
await k.waitForTimeout(1500);
await k.locator(".tb-actions .btn").last().click();
await k.waitForTimeout(800);
const fits = await k.evaluate(() => {
  const m = document.querySelector(".modal");
  if (!m) return false;
  const r = m.getBoundingClientRect();
  return r.top >= 0 && (r.bottom <= window.innerHeight + 1 || m.scrollHeight > m.clientHeight);
});
check(fits, "short screen: the Connect window fits or scrolls");
await kbd.close();

// Feedback window: page details, the form and e-mail buttons, nothing personal.
const ctx = await browser.newContext(devices["iPhone 13"]);
await ctx.addInitScript(() => localStorage.setItem("zapr_welcomed", "1"));
const p = await ctx.newPage();
await p.goto(B + "/how-it-works");
await p.waitForTimeout(1500); // the page must be interactive before the click
const link = p.locator(".site-footer .link-btn", { hasText: "Feedback" });
if (await link.count()) {
  await link.click();
  await p.locator(".modal .fb-details").waitFor();
  const details = await p.locator(".modal .fb-details").innerText();
  check(/Page: .*\/how-it-works/.test(details) && /Device: iPhone/.test(details) && /Time: /.test(details), "feedback: page, device and time");
  check(!/\bIP\b|wallet/i.test(details), "feedback: no IP, no wallet in the details");
  const form = await p.locator(".modal a", { hasText: "Open the feedback form" }).getAttribute("href").catch(() => null);
  const mail = await p.locator(".modal a", { hasText: "Email" }).getAttribute("href").catch(() => null);
  check(Boolean(form?.startsWith("https://")) || Boolean(mail?.startsWith("mailto:")), `feedback: form ${form ?? "-"} / ${mail ? mail.slice(0, 40) + "…" : "no e-mail"}`);
} else {
  console.log("skip - feedback link hidden (build without NEXT_PUBLIC_FEEDBACK_URL / NEXT_PUBLIC_CONTACT_EMAIL)");
}
await ctx.close();

await browser.close();
check(errors.length === 0, `no page errors${errors.length ? ": " + errors.join(" | ") : ""}`);
console.log(fails ? `\n${fails} FAILED` : "\nALL PASSED");
process.exit(fails ? 1 : 0);
