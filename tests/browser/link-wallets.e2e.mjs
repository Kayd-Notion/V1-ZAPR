// Browser test of wallet linking (Settings → Link a wallet) with fake Phantom and
// Solflare wallets that really sign: link another app, a second Phantom account,
// refusals, unlink, and the session rules. Not part of `npm test`.
//
//   npx next dev -p 3100            (demo store, or DATABASE_URL for Postgres)
//   BASE_URL=http://localhost:3100 node tests/browser/link-wallets.e2e.mjs
//
import { chromium } from 'playwright-core';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
const B = process.env.BASE_URL || 'http://localhost:3100';
let fails = 0;
const check = (c, m) => { if (!c) fails++; console.log((c ? 'ok  - ' : 'FAIL - ') + m); };
const kps = [0, 1, 2, 3, 4, 5].map(() => nacl.sign.keyPair());
const addr = kps.map((k) => bs58.encode(k.publicKey));
const short = (w) => `${w.slice(0, 4)}…${w.slice(-4)}`;
const secretOf = Object.fromEntries(kps.map((k, i) => [addr[i], k.secretKey]));

// Cookie-jar API client (Node side).
const client = () => {
  let cookie = '';
  const call = async (path, init = {}) => {
    const r = await fetch(B + path, { ...init, headers: { 'content-type': 'application/json', cookie } });
    for (const sc of r.headers.getSetCookie()) { const kv = sc.split(';')[0]; const n = kv.split('=')[0]; cookie = cookie.split('; ').filter((c) => c && !c.startsWith(n + '=')).concat(kv).join('; '); }
    return { status: r.status, body: await r.json() };
  };
  const signIn = async (i) => {
    const n = await call(`/api/auth/nonce?wallet=${addr[i]}`);
    return call('/api/auth/verify', { method: 'POST', body: JSON.stringify({ wallet: addr[i], signature: bs58.encode(nacl.sign.detached(new TextEncoder().encode(n.body.message), kps[i].secretKey)) }) });
  };
  return { call, signIn, session: () => cookie.split('; ').find((c) => c.startsWith('zapr_session='))?.split('=').slice(1).join('=') };
};

const alice = client();
await alice.signIn(0);
const handle = 'link_' + Date.now().toString(36).slice(-5);
const created = await alice.call('/api/users', { method: 'POST', body: JSON.stringify({ handle }) });
const aliceId = created.body.user.id;
// Another account (wallet 4) to test "already has its own account".
const other = client(); await other.signIn(4);
await other.call('/api/users', { method: 'POST', body: JSON.stringify({ handle: 'oth_' + Date.now().toString(36).slice(-5) }) });

const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([{ name: 'zapr_session', value: alice.session(), url: B }]);
await ctx.exposeFunction('__zsign', (a, bytes) => [...nacl.sign.detached(Uint8Array.from(bytes), secretOf[a])]);
// Two Wallet Standard wallets: "Phantom" (accounts 0 → can switch) and "Solflare" (account 1).
await ctx.addInitScript(({ ph, sf, pool }) => {
  localStorage.setItem('zapr_welcomed', '1');
  localStorage.setItem('zapr_logged_in', '1');
  localStorage.setItem('walletName', JSON.stringify('Phantom'));
  const mk = (name, start) => {
    const listeners = [];
    let cur = start;
    const acct = (k) => ({ address: k.addr, publicKey: new Uint8Array(k.pub), chains: ['solana:devnet'], features: ['solana:signMessage', 'solana:signTransaction'] });
    const w = {
      version: '1.0.0', name, chains: ['solana:devnet', 'solana:mainnet'],
      icon: 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="' + (name === 'Phantom' ? '#ab9ff2' : '#fc7227') + '"/></svg>'),
      accounts: [],
      features: {
        'standard:connect': { version: '1.0.0', connect: async () => { w.accounts = [acct(cur)]; return { accounts: w.accounts }; } },
        'standard:disconnect': { version: '1.0.0', disconnect: async () => { w.accounts = []; } },
        'standard:events': { version: '1.0.0', on: (ev, fn) => { listeners.push(fn); return () => {}; } },
        'solana:signMessage': { version: '1.0.0', signMessage: async (...inputs) => Promise.all(inputs.map(async ({ account, message }) => ({ signedMessage: message, signature: new Uint8Array(await window.__zsign(account.address, [...message])) }))) },
        'solana:signTransaction': { version: '1.0.0', supportedTransactionVersions: ['legacy', 0], signTransaction: async () => { throw new Error('no tx in this test'); } },
      },
    };
    const switchTo = (k) => { cur = k; if (w.accounts.length) { w.accounts = [acct(k)]; listeners.forEach((fn) => fn({ accounts: w.accounts })); } };
    return { w, switchTo };
  };
  const phantom = mk('Phantom', ph), solflare = mk('Solflare', sf);
  window.__phantomSwitch = (i) => phantom.switchTo(pool[i]);
  const register = ({ register }) => { register(phantom.w); register(solflare.w); };
  window.addEventListener('wallet-standard:app-ready', (e) => register(e.detail));
  try { window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: register })); } catch {}
}, {
  ph: { addr: addr[0], pub: [...kps[0].publicKey] },
  sf: { addr: addr[1], pub: [...kps[1].publicKey] },
  pool: kps.map((k, i) => ({ addr: addr[i], pub: [...k.publicKey] })),
});

await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
  let last = '';
  new MutationObserver(() => { const t = document.querySelector('.toast'); const x = t?.textContent || ''; if (x && x !== last) { last = x; window.__toast(x); } }).observe(document.body, { subtree: true, childList: true, characterData: true });
}));
// Compile the new routes first (dev server).
await fetch(B + '/api/wallets/challenge?wallet=x'); await fetch(B + '/api/wallets', { method: 'DELETE' });
const p = await ctx.newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const toasts = [];
await p.exposeFunction('__toast', (t) => toasts.push(t));
await p.goto(B + '/settings', { timeout: 90000 });
await p.waitForFunction(() => document.body.innerText.includes('Main wallet'), null, { timeout: 60000 }).catch(() => {});
await p.waitForTimeout(1500);
const btn = async () => (await p.locator('.tb-actions .btn').last().innerText()).trim();
const me = () => p.evaluate(() => fetch('/api/auth/me').then((r) => r.json()));
const lastToast = () => toasts[toasts.length - 1] || '';

check((await btn()) === short(addr[0]), `signed in with Phantom account 0 (${await btn()})`);
check(await p.getByText('Main wallet').isVisible(), 'Settings shows the Wallets group with the main wallet');

// 1. Link Solflare (another app).
await p.locator('.settings-row', { hasText: 'Link a wallet' }).click(); await p.waitForTimeout(800);
await p.locator('.modal .wallet-option', { hasText: 'Solflare' }).click(); await p.waitForTimeout(3500);
check(lastToast().includes('Wallet linked'), `Solflare linked: toast "${lastToast()}"`);
check(!(await p.locator('.modal').isVisible()), 'Link window closed');
let m = await me();
check(m.user?.id === aliceId && m.user.linkedWallets?.map((w) => w.wallet).join() === addr[1], 'server: Solflare wallet is linked to the account');
check((await btn()) === short(addr[1]), `still signed in, now using Solflare (${await btn()})`);

// 2. That wallet now signs in to the same account (fresh browser = fresh API client).
const viaSolflare = client(); const r = await viaSolflare.signIn(1);
check(r.body.user?.id === aliceId, 'signing in with the linked wallet opens the same account');

// 3. Same app, another account: Phantom back on account 0 (already on the account) shows a hint; switching account links it.
await p.locator('.settings-row', { hasText: 'Link a wallet' }).click(); await p.waitForTimeout(600);
await p.locator('.modal .wallet-option', { hasText: 'Phantom' }).click(); await p.waitForTimeout(2500);
check((await me()).user?.id === aliceId, 'switching back to the main wallet keeps the session');
await p.locator('.modal .wallet-option', { hasText: 'Phantom' }).click(); await p.waitForTimeout(500);
const hint = await p.locator('.lw-hint').innerText().catch(() => '');
check(hint.includes('switch account in Phantom'), `hint for another Phantom account: "${hint.slice(0, 90)}…"`);
await p.evaluate(() => window.__phantomSwitch(2)); await p.waitForTimeout(3500);
check(lastToast().includes('Wallet linked'), `Phantom account 2 linked by switching account: "${lastToast()}"`);
m = await me();
check(m.user?.linkedWallets?.length === 2, 'server: 2 linked wallets');

// 4. A wallet that already has its own account is refused; closing the window lets it go, session kept.
await p.locator('.settings-row', { hasText: 'Link a wallet' }).click(); await p.waitForTimeout(600);
await p.evaluate(() => window.__phantomSwitch(4)); await p.waitForTimeout(3000);
check(lastToast().includes('already has its own ZAPR account'), `taken wallet refused: "${lastToast()}"`);
check(await p.locator('.modal').isVisible(), 'Link window stays open to try another wallet');
await p.keyboard.press('Escape'); await p.waitForTimeout(2500);
m = await me();
check(m.user?.id === aliceId, 'closing the window: still signed in to the account');
check((await btn()) !== 'Connect', `top button still signed in (${await btn()})`);

// 5. Settings list + unlink.
await p.goto(B + '/settings'); await p.waitForTimeout(4000);
const rows = await p.locator('.settings-group', { hasText: 'Main wallet' }).locator('.settings-row').allInnerTexts();
console.log('   rows:', rows.map((t) => t.replace(/\n/g, ' | ')));
check(rows.some((t) => t.includes('Solflare') && t.includes(short(addr[1]))), 'Solflare row listed');
const sfRow = p.locator('.settings-row', { hasText: short(addr[1]) });
await sfRow.getByRole('button', { name: 'Unlink' }).click();
await sfRow.getByRole('button', { name: 'Unlink for real' }).click(); await p.waitForTimeout(1500);
check(lastToast().includes('Wallet unlinked'), `unlinked: "${lastToast()}"`);
m = await me();
check(m.user?.linkedWallets?.map((w) => w.wallet).join() === addr[2], 'server: only Phantom account 2 is left');
// The Solflare session (opened before) is over now.
const after = await viaSolflare.call('/api/auth/me');
check(after.body.user === null, 'a session opened with the unlinked wallet ends');

// 6. Server rules.
const delMain = await alice.call('/api/wallets', { method: 'DELETE', body: JSON.stringify({ wallet: addr[0] }) });
check(delMain.status === 400, 'the main wallet can\'t be unlinked');
const viaPh2 = client(); await viaPh2.signIn(2);
const delSelf = await viaPh2.call('/api/wallets', { method: 'DELETE', body: JSON.stringify({ wallet: addr[2] }) });
check(delSelf.status === 409, 'the wallet you signed in with can\'t be unlinked');
// Link without a valid signature / with a sign-in signature.
const ch = await alice.call(`/api/wallets/challenge?wallet=${addr[5]}`);
check(ch.body.message?.includes(`@${handle}`), 'link message names the account');
const bad = await alice.call('/api/wallets', { method: 'POST', body: JSON.stringify({ wallet: addr[5], signature: bs58.encode(nacl.sign.detached(new TextEncoder().encode(ch.body.message), kps[3].secretKey)), label: 'x' }) });
check(bad.status === 401, 'a signature from another wallet is refused');
const n = await alice.call(`/api/auth/nonce?wallet=${addr[5]}`);
const replay = await alice.call('/api/wallets', { method: 'POST', body: JSON.stringify({ wallet: addr[5], signature: bs58.encode(nacl.sign.detached(new TextEncoder().encode(n.body.message), kps[5].secretKey)), label: 'x' }) });
check(replay.status === 401, 'a sign-in signature can\'t be used to link');
const anon = await client().call(`/api/wallets/challenge?wallet=${addr[5]}`);
check(anon.status === 401, 'signed-out visitors can\'t link');

// 7. Outside linking: switching to an unlinked account still ends the session.
// (Closing the Link window in step 4 let Phantom go: reconnect it first.)
await p.evaluate(() => localStorage.setItem('walletName', JSON.stringify('Phantom')));
await p.reload(); await p.waitForTimeout(4000);
check((await btn()) === short(addr[0]), `Phantom reconnected on the main wallet (${await btn()})`);
await p.evaluate(() => window.__phantomSwitch(2)); await p.waitForTimeout(2000);
check((await btn()) === short(addr[2]), `switching to a linked account keeps the session (${await btn()})`);
await p.evaluate(() => window.__phantomSwitch(5)); await p.waitForTimeout(3000);
check((await btn()).toUpperCase() === 'CONNECT', `unlinked account switch outside linking: signed out (${await btn()})`);

await b.close();
console.log(errors.length ? errors : 'no page errors');
console.log(fails ? `${fails} FAILED` : 'ALL PASSED');
process.exit(fails ? 1 : 0);
