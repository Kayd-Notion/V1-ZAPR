# ZAPR V1 — Checklist de test (devnet, avec Phantom)

À faire sur **https://v1zapr.vercel.app**, sans rien installer à part l'extension
Phantom (ou Phantom sur téléphone). Compte environ 30 minutes.

## 0. Avant de commencer (une seule fois)

Dans Vercel → projet → **Settings → Environment Variables**, vérifier :

| Variable | Valeur | Pourquoi |
| --- | --- | --- |
| `DATABASE_URL` | posée par Neon | sinon les données s'effacent |
| `SESSION_SECRET` | 32+ caractères au hasard | sécurité des connexions |
| `NEXT_PUBLIC_FOUNDER_WALLET` | **ton** adresse Phantom (devnet) | reçoit les 30 % / 10 %, et fait de toi le **seul admin** |
| `NEXT_PUBLIC_SOLANA_RPC` | conseillé : une URL devnet Helius (gratuit) | le RPC public devnet est souvent saturé |
| `CRON_SECRET` | facultatif, des caractères au hasard | protège le nettoyage quotidien |
| `PUMP_REQUIRE_ONCHAIN_VERIFY` | ne rien mettre | la vérification on-chain est **active par défaut en production** |

Après un changement : **Deployments → ⋯ → Redeploy**.

Il te faut **deux wallets** (deux comptes dans Phantom : « Ajouter un compte »).
Appelons-les **A** (toi, admin) et **B** (un ami / ton deuxième compte).

## 1. Avoir des SOL de test

- [ ] Sur ZAPR, connecte le wallet A → page **Wallet** → **Devnet faucet +1 SOL**.
- [ ] Si « Faucet is dry » : va sur https://faucet.solana.com, colle l'adresse,
      choisis **Devnet** (se connecter avec GitHub aide beaucoup).
- [ ] Pareil pour le wallet B.

Pas besoin de passer Phantom sur devnet : ZAPR envoie lui-même la transaction
sur devnet (Phantom ne fait que signer).

## 2. Visiteur

- [ ] Fenêtre privée : la fenêtre **Welcome to ZAPR** apparaît une fois.
- [ ] **How it works** se lit bien (répartition, paliers, FAQ).
- [ ] Le fil, le Top, le Live et la recherche marchent sans wallet.

## 3. Compte et profil (wallet B)

- [ ] **Connect** → Phantom demande de **signer un message** (gratuit) → choisir un pseudo.
- [ ] **Settings** → **Add a picture** → Phantom demande un petit paiement (stockage
      Arweave) → la photo apparaît partout.
- [ ] **Settings → Wallets → Link a wallet** → dans Phantom, passe sur un **autre compte**
      (jamais utilisé sur ZAPR) → Phantom demande de signer → « Wallet linked ».
      Le compte apparaît sous « Main wallet ». Déconnecte-toi, reconnecte-toi avec ce
      compte : c'est **le même profil**. Puis **Unlink** (depuis le wallet principal).
- [ ] Essaie de lier le wallet A (qui a déjà son compte) : refusé, message clair.

## 4. Poster, zapper

- [ ] B publie un post avec un **#tag** et un **@pseudo** → ils sont cliquables.
- [ ] A ouvre le post → **Send a zap** → bouton **Reach the next boost** →
      Phantom affiche le montant → signer.
- [ ] Le total du post augmente, la jauge de vie aussi.
- [ ] **Wallet → Activity** de A : « You zapped @B's post », lien vers l'explorateur
      → la transaction existe bien sur devnet avec **deux transferts** (70 % / 30 %).
- [ ] **Wallet → Activity** de B : « @A zapped your post », +70 %.
- [ ] B reçoit une **notification**.

## 5. Créateur

- [ ] A suit B (**Follow**) → le post de B apparaît dans l'onglet **Following**.
- [ ] A fait **Zap this creator** sur le profil de B → 90 % pour B.
- [ ] B apparaît dans le **Top → Creators**.

## 6. Supprimer, signaler, modérer

- [ ] B publie un deuxième post et le **supprime** (menu « ⋯ », deux appuis).
- [ ] B essaie de supprimer le post zappé → impossible (« Zapped posts can't be deleted »).
- [ ] A **signale** un post de B (menu « ⋯ » → Report post).
- [ ] A ouvre **Admin** (rail de gauche, ou Settings → Admin sur mobile) :
      chiffres clés, le signalement est là.
- [ ] A **masque** le post → il disparaît du fil ; **Unhide** le remet.
- [ ] (Facultatif) A **bannit** B → B voit le bandeau « suspended » et ne peut plus
      poster ; **Unban** le rétablit.

## 7. Partage

- [ ] Sur téléphone, **Partager** ouvre la feuille de partage.
- [ ] Le lien d'un post collé dans Telegram / X / Discord montre une image avec
      le texte du post, le total zappé et le temps restant.

## Si quelque chose bloque

Note : la page, ce que tu as cliqué, le message affiché (une capture suffit),
et si c'est sur téléphone ou ordinateur. Pour un zap, le lien de la transaction
(Wallet → Activity) aide beaucoup.
