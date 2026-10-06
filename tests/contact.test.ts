// Feedback and contact settings (lib/contact.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { describePage, feedbackMailto, parseEmail, parseFormUrl } from "../src/lib/contact";

test("contact e-mail: only a real address", () => {
  assert.equal(parseEmail(" hello@zapr.app "), "hello@zapr.app");
  assert.equal(parseEmail("mailto:hello@zapr.app"), "hello@zapr.app");
  for (const bad of [undefined, "", "hello", "hello@", "@zapr.app", "a b@zapr.app", "<x@y.io>"]) assert.equal(parseEmail(bad), "", String(bad));
});

test("feedback form: only an https link", () => {
  assert.equal(parseFormUrl("https://tally.so/r/abc"), "https://tally.so/r/abc");
  for (const bad of [undefined, "", "tally.so/r/abc", "http://tally.so/r/abc", "javascript:alert(1)"]) assert.equal(parseFormUrl(bad), "", String(bad));
});

test("feedback e-mail: prefilled, with page details and nothing personal", () => {
  const d = { page: "https://v1zapr.vercel.app/post/1", device: "iPhone, 390×844", time: "2026-10-06T10:00:00.000Z" };
  const link = feedbackMailto("hello@zapr.app", d);
  assert.ok(link.startsWith("mailto:hello@zapr.app?subject=ZAPR%20beta%20feedback&body="));
  const body = decodeURIComponent(link.split("body=")[1]);
  assert.match(body, /Page: https:\/\/v1zapr\.vercel\.app\/post\/1/);
  assert.match(body, /Device: iPhone/);
  assert.doesNotMatch(body, /\bIP\b|wallet|address/i);
  assert.equal(feedbackMailto("", d), "");
  assert.equal(describePage(d).split("\n").length, 3);
});
