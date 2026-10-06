# ZAPR beta: tester guide

Thanks for testing ZAPR! This takes about 20 minutes.

**ZAPR** is a social network on Solana. You post, and people "zap" your post with SOL:
- the creator gets **70 %**, the platform 30 %;
- each zap keeps the post alive longer;
- the most zapped posts and creators climb the **Top**.

**The beta runs on Solana _devnet_, a test network. Its SOL is free and worth nothing.
You can't lose real money.** Zaps on the real network (mainnet) are switched off.

Site: **https://v1zapr.vercel.app**

---

## Safety first (read this)

- Use a **new wallet made for testing**, not one that holds real funds.
- **Never share your recovery phrase (12 or 24 words) or your private key.** Nobody from
  ZAPR will ever ask for it: not in a form, not by e-mail, not in a DM.
- Signing in only asks you to **sign a message**. That's free and moves no money.
  A zap shows a real transaction in your wallet: read the amount before approving.

## 1. Install Phantom

**Computer (Chrome, Brave, Edge or Firefox)**
1. Go to **https://phantom.com/download** and add the browser extension.
2. Open Phantom → **Create a new wallet** → write your recovery phrase on paper and
   keep it private.

**Phone (iPhone or Android)**
1. Install **Phantom** from the App Store or Google Play.
2. Create a new wallet the same way.

## 2. Devnet: nothing to switch

ZAPR sends its transactions on devnet by itself, so **you don't have to change anything
in Phantom**.

Optional: to see your test SOL inside Phantom, open **Settings → Developer Settings**,
turn on **Testnet Mode** and pick **Solana Devnet** (menu names can vary a little
between versions). You can always see your balance on ZAPR's **Wallet** page.

## 3. Get free test SOL

1. On ZAPR, click **Connect** (top right), pick **Phantom** and **sign the message**.
   Choose a username.
2. Open the **Wallet** page and tap **Devnet faucet**: you get 1 test SOL.
3. If it says the faucet is dry, go to **https://faucet.solana.com**:
   - paste your wallet address (copy it from the Wallet page);
   - choose **Devnet**, then confirm.
   - Signing in there with GitHub raises the limit.

0.5 test SOL is plenty for the whole test.

## 4. On your phone: open ZAPR inside Phantom

Phones have no browser extensions, so open ZAPR **in Phantom's built-in browser**:
open Phantom, tap the **browser / explore** icon, type `v1zapr.vercel.app` and go.

Or open the site in Safari / Chrome, then tap **Connect → More wallets → Phantom →
Open in app**.

## 5. What to test

Do as many as you can, in any order. The ones marked ★ matter most.

- ★ **Post something**: text, a #tag, an @username, and a photo if you can (a photo asks
  for a tiny storage payment).
- ★ **Zap a post**: open a post → **Zap** → pick an amount → approve in Phantom.
  The post's total and its life bar go up.
- ★ **Check your history**: **Wallet → Activity** lists your zaps, with a link to the
  transaction on the Solana explorer.
- **Follow** someone: their posts show up in the **Following** tab.
- **Zap a creator** directly from their profile (**Zap this creator**).
- **Top**: the most zapped posts and creators. Each zap counts for its **full amount**.
  Zapping your own post works and keeps it alive, but **doesn't count** in the Top.
- **Comment**, **share** a post, **search** (magnifier at the top).
- **Settings**: change your username, bio and picture; try the privacy switches.
- **Link a wallet** (Settings → Wallets): add a second wallet to your account. Both then
  sign in to the same profile.
- **Report** a post (menu **⋯**) if you see something bad.

Things that are **normal**:
- **Posts expire.** A post lives 24 hours, plus extra time for each zap. When it
  expires, it disappears.
- **A post with zaps can't be deleted.**
- **Photos are public and permanent** (stored on Arweave).
- **"Continue with Google" may not be there yet.** It's being set up. Apple sign-in
  isn't available.

## 6. Report a bug or an idea

Use the **Feedback** link at the bottom of any page, or **Settings → Report a bug or
send feedback**. It opens our form or your e-mail app, and adds the page, your device
type and the time. ZAPR adds nothing about you or your wallet, and doesn't record your
IP address.

A good report says:
1. **what you did** (the steps);
2. **what happened**;
3. **what you expected**.

A **screenshot** helps a lot. For a zap problem, add the transaction link from
**Wallet → Activity**.

**Never put your recovery phrase or private key in a report.**

## Privacy, in short

- No e-mail or password to sign up: your account is your wallet.
- ZAPR doesn't store your IP address. Only a country code is kept, for the leaderboards
  by country.
- Blockchain transactions (zaps) and photos on Arweave are public, as on any Solana app.

Full details: **Privacy**, **Terms** and **Risks**, linked at the bottom of every page.
