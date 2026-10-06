# ZAPR V1 : checklist de test (devnet)

À faire sur **https://v1zapr.vercel.app**. Deux parcours : **ordinateur** (extension
Phantom) puis **téléphone** (application Phantom). Compte environ 45 minutes en tout.
Coche chaque case. Si une case ne marche pas, note-la (voir « Si quelque chose bloque »
en bas).

## 0. Avant de commencer (une seule fois)

Dans Vercel → projet **v1zapr** → **Settings → Environment Variables**, vérifie :

| Variable | Valeur | Pourquoi |
| --- | --- | --- |
| `DATABASE_URL` | posée par Neon | sinon les données s'effacent |
| `SESSION_SECRET` | 32+ caractères au hasard | sécurité des connexions |
| `NEXT_PUBLIC_FOUNDER_WALLET` | **ton** adresse Phantom | reçoit les 30 % / 10 %, et fait de toi le **seul admin** |
| `NEXT_PUBLIC_SOLANA_RPC` | conseillé : une URL **devnet** Helius (gratuit) | le RPC public devnet est souvent saturé (voir `docs/RPC-SETUP.md`) |
| `SOLANA_RPC_URL` | facultatif : une 2ᵉ URL devnet, type **Secret** | RPC du serveur, jamais montré aux visiteurs |
| `NEXT_PUBLIC_FEEDBACK_URL` | le lien de ton formulaire (Tally, Google Forms…) | bouton « Feedback » (voir `docs/FEEDBACK-SETUP.md`) |
| `NEXT_PUBLIC_CONTACT_EMAIL` | ton adresse de contact | bouton e-mail + pages légales |
| `NEXT_PUBLIC_PRIVY_APP_ID` | l'App ID Privy | bouton Google (voir `docs/PRIVY-SETUP.md`) |
| `CRON_SECRET` | facultatif, des caractères au hasard | protège le nettoyage quotidien |
| `PUMP_REQUIRE_ONCHAIN_VERIFY` | ne rien mettre | la vérification on-chain est **active par défaut sur Vercel** (production et préversions) |

Les variables `NEXT_PUBLIC_…` se mettent en type **Config** (pas « Secret »).
Après un changement : **Deployments → ⋯ → Redeploy**.

Il te faut **deux wallets** (deux comptes dans Phantom : « Ajouter un compte »).
Appelons-les **A** (toi, admin) et **B** (un ami ou ton deuxième compte).

## 1. Avoir des SOL de test

- [ ] Sur ZAPR, connecte le wallet A → page **Wallet** → **Devnet faucet +1 SOL**.
- [ ] Si « Faucet is dry » : va sur https://faucet.solana.com, colle l'adresse,
      choisis **Devnet** (se connecter avec GitHub aide beaucoup).
- [ ] Pareil pour le wallet B.

Pas besoin de passer Phantom sur devnet : ZAPR envoie lui-même la transaction sur devnet,
Phantom ne fait que signer.

---

# Partie 1 : ordinateur

## 2. Visiteur

- [ ] Fenêtre privée : la fenêtre **Welcome to ZAPR** apparaît une fois.
- [ ] **How it works** se lit bien (répartition, paliers, FAQ).
- [ ] Le fil, le Top, le Live et la recherche marchent sans wallet.
- [ ] En bas de page, le lien **Feedback** ouvre la fenêtre « Report a bug or send
      feedback » (si `NEXT_PUBLIC_FEEDBACK_URL` ou `NEXT_PUBLIC_CONTACT_EMAIL` est posé).

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

## 5. Classements (nouvelles règles)

- [ ] **Top → Posts** : le post de B affiche **100 %** du zap de A (ex. A zappe 0.1 SOL →
      le Top montre 0.1, pas 0.07).
- [ ] B **zappe son propre post** (auto-zap) : c'est accepté, le post vit plus longtemps,
      **aucun badge** n'apparaît, et le **Top augmente** comme pour n'importe quel zap.
- [ ] **Top → Creators** : B apparaît, avec « SOL zapped ».
- [ ] A ouvre **Admin** : les lignes **Rankings check**, **Security check** et **Network**
      sont vertes (✓). Si l'une est rouge, fais une capture et envoie-la-moi.

## 6. Créateur

- [ ] A suit B (**Follow**) → le post de B apparaît dans l'onglet **Following**.
- [ ] A fait **Zap this creator** sur le profil de B → 90 % pour B.
- [ ] Le total de B dans **Top → Creators** augmente du montant **entier**.

## 7. Supprimer, signaler, modérer

- [ ] B publie un deuxième post et le **supprime** (menu « ⋯ », deux appuis).
- [ ] B essaie de supprimer le post zappé → impossible (« Zapped posts can't be deleted »).
- [ ] A **signale** un post de B (menu « ⋯ » → Report post).
- [ ] A ouvre **Admin** (rail de gauche, ou Settings → Admin sur mobile) :
      chiffres clés, le signalement est là.
- [ ] A **masque** le post → il disparaît du fil ; **Unhide** le remet.
- [ ] (Facultatif) A **bannit** B → B voit le bandeau « suspended » et ne peut plus
      poster ; **Unban** le rétablit.

## 8. Google (seulement après `docs/PRIVY-SETUP.md`)

- [ ] Fenêtre privée → **Connect → Continue with Google** → choisir un pseudo.
- [ ] **Settings → Link a wallet → Phantom** → « Wallet linked ».
- [ ] Avec un compte Phantom : **Settings → Link a wallet → Link Google** →
      « Wallet linked », ligne **Google wallet**.

## 9. Retours

- [ ] **Settings → Report a bug or send feedback** : la fenêtre montre la page,
      l'appareil et l'heure (pas d'adresse IP, pas de wallet).
- [ ] **Open the feedback form** ouvre ton formulaire dans un nouvel onglet ;
      **Email …** ouvre ta messagerie avec un message prérempli.

---

# Partie 2 : téléphone

Sur téléphone, il n'y a pas d'extension : on ouvre ZAPR **dans l'application Phantom**.

## 10. Ouvrir ZAPR dans Phantom

- [ ] Installe **Phantom** (App Store / Google Play) et importe ou crée un wallet.
- [ ] Dans Phantom, touche l'icône **loupe / navigateur** (en bas), tape
      `v1zapr.vercel.app`, valide.
- [ ] Autre chemin : ouvre le site dans Safari / Chrome → **Connect → More wallets →
      Phantom → Open in app**. ZAPR s'ouvre dans Phantom.

## 11. Navigation au doigt

- [ ] La barre du bas (Feed, Live, Top, Wallet, Profile) répond du premier coup.
- [ ] Le bouton jaune **+** (écrire un post) ne cache pas le dernier post : en faisant
      défiler jusqu'en bas, tout le contenu passe au-dessus.
- [ ] Rien ne dépasse sur le côté (pas de défilement horizontal), page par page :
      Feed, un post, Top, Live, Wallet, Settings, Profile, How it works.
- [ ] Les petits boutons (commentaires, partager, « ⋯ », signaler un commentaire,
      ZAP du Live) se touchent facilement.
- [ ] Les fenêtres (Connect, zap, écrire un post, Link a wallet, Feedback) s'ouvrent
      **depuis le bas de l'écran** et se ferment avec la croix.

## 12. Zapper au téléphone

- [ ] **Connect** → Phantom demande de signer → pseudo (wallet B si nouveau).
- [ ] Sur un post : **ZAP** → choisir un montant → Phantom affiche la transaction →
      **Approuver** → le total augmente.
- [ ] Écrire un post avec une **photo** depuis la galerie → Phantom demande le petit
      paiement de stockage → la photo s'affiche.
- [ ] Quand le clavier est ouvert (écrire un post, un commentaire), le bouton
      d'envoi reste visible.

## 13. Partage au téléphone

- [ ] Le bouton **Partager** d'un post ouvre la feuille de partage du téléphone.
- [ ] Le lien collé dans Telegram / X / Discord montre une image avec le texte du post,
      le total zappé et le temps restant.

## 14. Retours au téléphone

- [ ] **Settings → Report a bug or send feedback** → **Email …** ouvre l'application
      mail du téléphone (ou **Open the feedback form** ouvre le formulaire).

---

## Si quelque chose bloque

Note :
- la page ;
- ce que tu as cliqué ;
- le message affiché (une capture suffit) ;
- si c'est sur téléphone ou ordinateur.

Sur ordinateur, ajoute les lignes rouges ou **[ZAPR]** de la console (**F12 → Console**).
Pour un zap, le lien de la transaction (**Wallet → Activity**) aide beaucoup.
Le plus simple : le bouton **Feedback** du site, qui ajoute la page et l'appareil
tout seul.
