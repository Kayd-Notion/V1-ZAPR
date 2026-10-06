# ZAPR: payment flow, for an external security audit

> **Pour Kayd (en français) :** ce document décrit à un auditeur comment l'argent
> circule dans ZAPR, ce qui le protège et les points sensibles. Envoie-le tel quel,
> avec l'accès au dépôt GitHub. La partie 9 est **ma propre relecture**. Elle **ne
> remplace pas un audit** fait par une société spécialisée, indépendante, qui engage
> sa responsabilité. ZAPR reste sur **devnet** : rien ici n'active le mainnet.

- **Version:** October 6, 2026.
- **Repository:** `Kayd-Notion/V1-ZAPR` (branch `main`).
- **Live (devnet):** https://v1zapr.vercel.app

---

## 1. Scope and status

ZAPR is a social network on **Solana**:
- users "zap" posts or creators with SOL;
- a zap is split between the **creator** and the **platform** (the founder's wallet);
- zaps extend a post's lifetime and drive the leaderboards.

**Current status:**
- **Network:** devnet only. Zaps are blocked on mainnet (section 7).
- **No custom on-chain program.** A zap is one ordinary Solana transaction with two
  `SystemProgram.transfer` instructions, built in the user's browser and signed by
  their wallet. The server then **checks the transaction on-chain** before recording it.
- **Custody:** the platform holds no user funds and no private key. Zaps go
  wallet-to-wallet; the platform wallet is only a receiving address.

**What we ask the auditor to cover:**
- **A. Web app and payment flow (current model):**
  - transaction construction (`src/lib/pump.ts`);
  - server-side verification and recording (`src/lib/verify-pump*.ts`, `src/app/api/posts/[id]/pump*`, `src/app/api/users/[handle]/zap*`);
  - authentication and sessions (`src/lib/auth*.ts`, `src/lib/session.ts`, `src/lib/wallet-link.ts`);
  - configuration guards (`src/lib/pump-config.ts`, `src/lib/solana.ts`, `src/lib/rpc-config.ts`, `src/lib/network-guard.ts`);
  - security headers (`next.config.mjs`).
- **B. If an Anchor program replaces the two transfers before mainnet:** a separate
  audit of that program. It **doesn't exist yet**; `src/lib/pump.ts` is the single
  place to swap.

## 2. Architecture

```
Browser (Next.js app, React)
  ├─ Wallet: Phantom / Solflare / … (Wallet Standard), or a Privy embedded wallet (Google sign-in)
  ├─ builds the zap transaction (2 transfers) ─► wallet signs ─► sent to the Solana RPC (NEXT_PUBLIC_SOLANA_RPC)
  └─ calls the ZAPR API (same origin, cookie session)

ZAPR API (Next.js route handlers on Vercel, Node runtime)
  ├─ sign-in: nonce → signed message → JWT session cookie
  ├─ zap "prepare": business rules before signing (post alive, minimum, not banned, not mainnet)
  ├─ zap "record": re-reads the transaction on-chain (server RPC, SOLANA_RPC_URL), checks payer / recipients / split, then records it
  └─ Postgres (Neon): users, linked wallets, posts, zap log, comments, follows, reports, rate limits

Third parties: Vercel (hosting), Neon (database), Solana RPC provider, Irys/Arweave (media), Privy (Google sign-in + embedded wallets)
```

## 3. Money flows

| Flow | Who pays | Recipients and split | Minimum | Code |
| --- | --- | --- | --- | --- |
| **Post zap** | the zapper's connected wallet | post author's **main** wallet **70 %**, platform wallet **30 %** | 0.005 SOL | `lib/pump.ts`, `lib/pump-config.ts` |
| **Creator zap** | the zapper's connected wallet | creator's main wallet **90 %**, platform **10 %** | 0.01 SOL | same, `CREATOR_ZAP_SPLIT` |
| **Media upload** | the poster's connected wallet | Irys (Arweave storage) | Irys price | `lib/irys.ts` (Irys devnet unless the whole site is on mainnet) |
| **Devnet faucet** | none (devnet airdrop) | the user | 1 SOL | `app/wallet/page.tsx` |

**Split arithmetic** (`splitLamports`):
- integer lamports;
- `platform = floor(total × platformBps / 10000)`;
- `creator = total − platform` (the creator absorbs rounding; no lamport created or lost).

**Configuration of the split:**
- The ratios come from `NEXT_PUBLIC_PUMP_CREATOR_BPS` / `NEXT_PUBLIC_PUMP_FOUNDER_BPS`.
- If they don't sum to 10000, the code falls back to 70/30.
- Creator zaps: the platform share is always `10000 − creator bps`.

**Minimums:** they keep both shares above the rent-exempt minimum of an empty
recipient account.

**Atomicity:** both transfers are in **one** transaction, so either both land or
neither does.

**Self-zaps:**
- **Zapping your own post is allowed.** The creator share comes back to you. It
  extends the post's life but is **excluded from the leaderboards**: zaps are
  recorded per account, so this covers every linked wallet.
- **A direct creator zap to yourself is refused** by the API.

## 4. Transaction construction (browser)

`buildPumpTransaction` / `sendPump` in `src/lib/pump.ts`:

1. **Mainnet guard:** refuses if the site is on mainnet (`IS_MAINNET`).
2. **Network guard (new):** reads the RPC's **genesis hash**. If it isn't the
   configured cluster's, it refuses (`assertRpcNetwork`, `lib/rpc-config.ts`). A
   mainnet RPC is never accepted on devnet; a local test validator is accepted
   off-mainnet.
3. **Recipients:** creator = post author's main wallet, given by the server
   ("prepare"); platform = `NEXT_PUBLIC_FOUNDER_WALLET`.
4. **Simulation:** `simulateTransaction` runs on the app's RPC, so a failing zap is
   never shown for signing.
5. **Sending:** preferred path is `signTransaction` + `sendRawTransaction` on the
   app's RPC. Fallback: wallet `sendTransaction`.
6. **Confirmation** at `confirmed`.

## 5. Recording and server-side verification

Order in `POST /api/posts/[id]/pump`. The creator-zap route
`POST /api/users/[handle]/zap` is equivalent.

1. **Mainnet guard:** 403 `mainnet_disabled`.
2. **Session:** a valid session is required (see 6).
3. **Input:**
   - amount > 0 and ≥ minimum;
   - a signature string is required;
   - the post must exist (a short grace period lets a zap signed just before expiry
     be recorded).
4. **Idempotency:** a signature already recorded (post zap **or** creator zap) gives
   409. The `signature` column is also `unique` in both tables.
5. **On-chain verification** (`verifyPumpTransaction`, pure part
   `checkTransferTx` in `verify-pump-core.ts`):
   - **When it runs:** on by default for **every Vercel deployment**, production
     **and previews** (`onchainVerifyDefault`); off only in local development;
     `PUMP_REQUIRE_ONCHAIN_VERIFY` overrides.
   - **Server RPC network:** it must match the cluster, otherwise the zap is refused.
   - **Reading the transaction:** `getParsedTransaction(signature, confirmed)`, up to
     5 attempts (~12 s). If it can't be read: 503 `verify_pending`, and the client
     retries.
   - **What is checked:**
     - the transaction succeeded;
     - the transfers come from **one of the zapper's account wallets** (main or
       linked);
     - the creator received `creatorLamports` and the platform `platformLamports`,
       ±10 lamports each.
6. **Aggregates are computed server-side** from the amount (the client's split is
   never trusted). Recorded:
   - the zap row;
   - the post total;
   - the creator's received total;
   - the zapper's sent total.

   One database transaction per zap.

**"Prepare" routes** (`.../pump/prepare`, `.../zap/prepare`): they enforce the
rules **before** the wallet opens — post alive, minimum, suspended accounts,
mainnet guard. They don't make recording safe on their own; step 5 does.

## 6. Identity, sessions, roles

- **Sign-in:**
  - `GET /api/auth/nonce` sets a signed (HS256) 5-minute nonce cookie;
  - the wallet signs a text message containing the wallet address, the nonce and the
    time;
  - `POST /api/auth/verify` checks the ed25519 signature and opens the session.
- **Session:** HS256 JWT in an `httpOnly`, `SameSite=Lax`, `Secure` (production)
  cookie, valid 30 days, signed with `SESSION_SECRET`. Content: the wallet used and
  the user id.
- **Linked wallets** (`lib/wallet-link.ts`):
  - an account can add up to 5 wallets;
  - each one signs a dedicated "link" message, bound to the account handle and a
    5-minute challenge;
  - a wallet already used by any account is refused;
  - a session opened with a wallet stops being valid as soon as that wallet is
    unlinked;
  - the main wallet (receiving zaps) can't be unlinked.
- **Google sign-in (Privy):**
  - the person signs in with Google through Privy;
  - ZAPR asks Privy to create a **Solana embedded wallet**, which is then used like
    any wallet (same message signature and on-chain checks);
  - key custody of that wallet is Privy's (export available to the user).
- **Admin:**
  - the account whose main wallet equals `NEXT_PUBLIC_FOUNDER_WALLET`, checked
    server-side on every admin route;
  - everyone else gets 404.
- **Moderation:**
  - banned users can't post, comment, follow or *start* a zap (prepare);
  - a zap already signed is still recorded (the money moved).

## 7. Configuration and safety guards

| Setting | Public? | Role / guard |
| --- | --- | --- |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | yes | `devnet` by default. **Mainnet blocks zaps** in the UI (buttons off), in `sendPump`, and in every zap API route (`lib/network-guard.ts`). |
| `NEXT_PUBLIC_SOLANA_RPC` / `SOLANA_RPC_URL` | yes / **no** | Browser RPC / server RPC. https only. Genesis-hash check before every zap and every verification. |
| `NEXT_PUBLIC_FOUNDER_WALLET` | yes | Platform wallet and admin identity. Required on mainnet (zaps refuse to build without it). On devnet, falls back to a demo address. |
| `NEXT_PUBLIC_PUMP_*_BPS`, `NEXT_PUBLIC_CREATOR_ZAP_CREATOR_BPS` | yes | Splits (sum guard). |
| `SESSION_SECRET` | **no** | Signs sessions. **If unset, a hard-coded development secret is used** (finding F3). /admin shows a red "Security check" when it is missing or shorter than 32 characters. |
| `PUMP_REQUIRE_ONCHAIN_VERIFY` | no | Overrides the on-chain check (on by default on Vercel). |
| `NEXT_PUBLIC_IRYS_NETWORK` | yes | Irys mainnet (real SOL) only if the whole site is on mainnet. |
| `CRON_SECRET` | no | Protects the nightly clean-up route (harmless job). |
| `DATABASE_URL` | no | Neon Postgres. |
| `NEXT_PUBLIC_PRIVY_APP_ID` | yes | Google sign-in (format-checked; a wrong value only turns it off). |

**HTTP security headers** (production): CSP (scripts, styles and fonts from self;
Privy and Cloudflare challenge frames), `frame-ancestors 'none'`, HSTS, `nosniff`,
`Referrer-Policy`, `Permissions-Policy`.

**Rate limits:** per account or wallet, **never per IP** — no IP address is stored,
by design.

## 8. Security assumptions

1. **The user's wallet** shows the real transaction (recipients, amounts) before
   signing, and the user reads it.
2. **The JavaScript served to the browser** is the code in the repository (Vercel
   build integrity, npm dependencies). The transaction is built there.
3. **The Solana RPC** returns truthful data. The server trusts one RPC response at
   `confirmed` commitment.
4. **Environment variables are correct**, especially `SESSION_SECRET`,
   `NEXT_PUBLIC_FOUNDER_WALLET` and the RPCs.
5. **Privy** keeps embedded-wallet keys safe and only signs for the logged-in user.
6. **Neon and Vercel** protect the database and secrets.

## 9. Our own review: sensitive points

> **This is a self-review by the development assistant, not an audit.** Severity is
> our estimate, for prioritising.

| # | Severity | Finding | Status / recommendation |
| --- | --- | --- | --- |
| F1 | **High (before mainnet)** | Payment logic runs in the browser: there is no on-chain program. A compromised front-end or dependency could redirect funds. The user's wallet shows the recipients, but few users check. The server check happens **after** the money moved. | Before mainnet: an audited program (fixed split, platform address in a config account), or at least a pinned-dependency review and a stricter CSP. |
| F2 | **Medium** | The sign-in message isn't bound to the site's domain (plain `signMessage`). A phishing site could relay ZAPR's message and get a ZAPR session for the victim. Funds can't be moved without another signature. | Use Sign-In With Solana (`solana:signIn`), where the wallet checks the domain. |
| F3 | **High if misconfigured** | `SESSION_SECRET` falls back to a public development value when unset, so sessions could be forged, including the admin's. | Shown in /admin "Security check". Recommended: refuse to start in production without it (**decision for Kayd**: it would block sign-in until the variable is set). |
| F4 | Medium | Sessions are stateless (30 days). Logout only clears the browser's cookie; a stolen cookie stays valid. Bans and unlinks are re-checked on every request. | Add a per-user session version to revoke all sessions; shorter lifetime. |
| F5 | Low | A recorded zap can be **any** matching transaction, even an old one or one made outside ZAPR. It isn't bound to a post (no memo) or to a time window. It can't be counted twice (unique signature). | Add a memo with the post id and a maximum age (needs a product decision). |
| F6 | Medium (product) | Leaderboard manipulation: two accounts can zap each other. It costs the platform share (30 % / 10 %) each time. Self-zaps are excluded per account only. | Heuristics or limits if it happens; watch with /admin. |
| F7 | Low | Verification trusts one RPC at `confirmed`. A malicious RPC could lie. | `finalized` and/or two RPCs on mainnet. |
| F8 | Info | CSP keeps `'unsafe-inline'` and `'unsafe-eval'` for scripts (Next.js bootstrapping, wallet libraries). XSS protection relies on React escaping. | Nonce-based CSP. |
| F9 | Medium | The admin is "the account of the founder wallet". Wallets linked to that account (e.g. Google via Privy) also open it, so a compromised Google account means admin access. | Don't link a social login to the founder account; or add 2FA for admin actions. |
| F10 | Info | Embedded (Google) wallets: their security is Privy's (third party, US). | Covered by Privy's own audits; mention in Privacy. |
| F11 | Low (fixed) | `NEXT_PUBLIC_IRYS_NETWORK=mainnet` would have spent real SOL on uploads while the site was on devnet. | Fixed: Irys mainnet only when the whole site is on mainnet. |
| F12 | Info | No IP-based limits (privacy by design). New wallets are free, so spam needs new sign-ins. | Per-wallet limits already exist; add a captcha or minimum balance if abused. |
| F13 | Low (fixed) | A wrong RPC (mainnet URL while on devnet) would have sent real SOL. | Fixed: genesis-hash guard (client and server), shown in /admin. |
| F14 | Low (fixed) | Previews ran without on-chain verification. A preview sharing the production database could receive fake zaps. | Fixed: verification on for all Vercel deployments. |
| F15 | Low (fixed) | Mainnet block was in the interface only. | Fixed: also in every zap API route and in `sendPump`. |

**Controls that exist and were tested:**
- **Zap and session checks:**
  - payer, recipients and split re-checked on-chain;
  - idempotent records;
  - server-side aggregates;
  - wallet-signature sign-in;
  - linked-wallet rules (signed, bound to the account, refusals);
  - suspended accounts.
- **Site-wide safeguards:**
  - admin restricted server-side;
  - rate limits;
  - no IP storage;
  - CSP;
  - the mainnet guards.

## 10. Recommended before mainnet

1. **An audited on-chain program** for the split, or a documented decision to stay on
   direct transfers, audited as such (F1).
2. **Sign-In With Solana with domain binding** (F2).
3. **Refuse to run without `SESSION_SECRET`** in production (F3), plus a session
   revocation mechanism (F4).
4. **A paid RPC on the server, `finalized` commitment for verification** (F7).
5. **Memo binding and a maximum age** for recorded transactions (F5).
6. **Legal review** (`docs/LEGAL-QUESTIONS.md`): commission on crypto payments,
   KYC/AML, GDPR.
7. **Incident plan:**
   - who can switch zaps off;
   - how: set `NEXT_PUBLIC_SOLANA_CLUSTER` back to devnet, or hide via /admin;
   - who to contact.

## 11. How to reproduce the tests

```
npm install
npm test                                   # unit tests (47): splits, verification, linking, rankings, RPC guard…
ZAPR_TEST_POSTGRES=1 DATABASE_URL=… npm test   # same on Postgres
```

- `tests/zap-e2e.local.mts`: **real zaps** on a local `solana-test-validator`, with
  on-chain verification on. Inflated amounts, someone else's transaction and a wrong
  split are refused.
- `tests/browser/*.e2e.mjs`: Chromium tests (wallet linking, Google with a fake
  Privy, rankings, phone layout).

## 12. Where to look

| Topic | Files |
| --- | --- |
| Building and sending a zap | `src/lib/pump.ts`, `src/hooks/usePump.ts`, `src/hooks/useCreatorZap.ts` |
| Splits, minimums, platform wallet | `src/lib/pump-config.ts`, `src/lib/pump-rules.ts` |
| On-chain verification | `src/lib/verify-pump.ts`, `src/lib/verify-pump-core.ts` |
| Zap API routes | `src/app/api/posts/[id]/pump/**`, `src/app/api/users/[handle]/zap/**` |
| Network / RPC guards | `src/lib/solana.ts`, `src/lib/solana-server.ts`, `src/lib/rpc-config.ts`, `src/lib/network-guard.ts` |
| Sign-in, sessions, linked wallets | `src/lib/auth-core.ts`, `src/lib/session.ts`, `src/lib/wallet-link.ts`, `src/app/api/auth/**`, `src/app/api/wallets/**` |
| Google / Privy | `src/components/PrivyBridge.tsx`, `src/lib/social-login.ts` |
| Admin, settings check | `src/lib/admin.ts`, `src/lib/config-check.ts`, `src/app/api/admin/**` |
| Database | `src/db/schema.sql`, `src/lib/db/postgres.ts` |
| Security headers | `next.config.mjs` |
