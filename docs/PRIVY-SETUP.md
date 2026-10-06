# Activer « Continue with Google » (guide pas à pas)

> **État au 6 octobre 2026 :** le code est prêt et testé avec un **faux Privy** (test
> automatique `tests/browser/link-google.e2e.mjs`). La **vraie** connexion Google n'a
> **pas encore été testée**. Elle le sera ensemble, une fois les étapes ci-dessous faites.

## Comment ça marche (en deux phrases)

ZAPR utilise **Privy**, un service qui gère la connexion avec Google. Quand quelqu'un
clique sur « Continue with Google », Privy vérifie son compte Google, puis ZAPR demande à
Privy de lui créer un **wallet Solana**. Rien à installer pour la personne ; ZAPR utilise
ensuite ce wallet comme Phantom.

Ce que tu vas faire : créer une app chez Privy, copier son **App ID** dans Vercel, puis
relancer le site. Compte environ **15 minutes**.

> **Attention aux mots de passe :** Privy te montrera aussi un **App Secret**.
> **Ne le copie nulle part**, ZAPR n'en a pas besoin. Seul l'**App ID** (public)
> est utile.

Les menus de Privy changent parfois de nom. Si un bouton ne s'appelle pas exactement
comme ici, cherche le plus proche. Les noms ci-dessous viennent de la documentation de
Privy d'octobre 2026.

---

## Étape 1 — Créer ton compte et ton app Privy

1. Ouvre **https://dashboard.privy.io** dans ton navigateur.
2. Crée un compte (avec ton e-mail), puis connecte-toi.
3. Si Privy te le propose, clique sur **Create app** (ou **New app**).
   - **Name** : écris `ZAPR`.
   - Si on te demande le type d'app ou la plateforme : choisis **Web** / **Client-side web**.
   - Valide.
4. Tu arrives sur la page de ton app. À gauche, il y a un menu (barre latérale).

## Étape 2 — Activer Google

1. Dans le menu de gauche, clique sur **Login methods**.
2. En haut de cette page, clique sur l'onglet **Socials**.
3. Trouve la ligne **Google** et clique sur son interrupteur : il devient **activé**
   (en couleur).
4. Ne touche à rien d'autre sur la ligne Google pour l'instant. Privy utilise alors ses
   propres identifiants Google, ce qui suffit pour la bêta. Plus tard, voir
   « Pour le lancement public » en bas de page.

Tu n'as **rien à activer pour les wallets Solana** : c'est ZAPR qui demande la création
du wallet, après la connexion Google.

## Étape 3 — Autoriser l'adresse du site

1. Dans le menu de gauche, ouvre **Configuration**, puis **App settings**.
2. Clique sur l'onglet **Domains**.
3. Dans la case **Allowed origins**, écris exactement :
   ```
   https://v1zapr.vercel.app
   ```
   Le `https://` est obligatoire, sans `/` à la fin.
4. Clique sur **Save** (ou **Add**).

Bon à savoir : Privy refuse les adresses de **préversion** Vercel (`…-git-….vercel.app`).
La connexion Google ne marchera donc que sur **https://v1zapr.vercel.app**.

## Étape 4 — Copier l'App ID

1. Toujours dans **Configuration → App settings**, clique sur l'onglet **Basics**.
2. Repère **App ID** : une suite de **25 lettres et chiffres** (elle commence souvent
   par `c`).
3. Clique sur l'icône **copier** à côté (ou sélectionne-la et fais Ctrl+C).
4. **Ne copie pas l'App Secret.**

## Étape 5 — Mettre l'App ID dans Vercel

1. Ouvre **https://vercel.com**, connecte-toi, puis clique sur le projet **v1zapr**.
2. En haut, clique sur **Settings**, puis dans le menu de gauche sur
   **Environment Variables**.
3. Remplis le formulaire d'ajout :
   - **Key** : `NEXT_PUBLIC_PRIVY_APP_ID`
   - **Value** : colle l'App ID (Ctrl+V), sans espace ni guillemets.
   - **Environments** : coche **Production** (les préversions ne marchent pas avec
     Google, voir l'étape 3).
   - **Type** : choisis **Config** (pas « Secret » : Vercel le refuse pour les
     variables qui commencent par `NEXT_PUBLIC_`, et cet identifiant est public de
     toute façon).
4. Clique sur **Save**.
5. Facultatif : la variable `NEXT_PUBLIC_SOCIAL_LOGINS` n'est **pas nécessaire**. Sans
   elle, ZAPR affiche le bouton Google.

## Étape 6 — Relancer le site (Redeploy)

La valeur est intégrée au site au moment où Vercel le construit. Il faut donc le
reconstruire :

1. En haut du projet Vercel, clique sur **Deployments**.
2. Sur la première ligne (le déploiement le plus récent, marqué **Production**),
   clique sur les **trois points ⋯** à droite.
3. Clique sur **Redeploy**, puis confirme avec **Redeploy**.
4. Attends que le statut passe à **Ready** (environ 2 minutes).

## Étape 7 — Vérifier que le bouton est là

1. Ouvre **https://v1zapr.vercel.app** dans une **fenêtre privée**
   (Ctrl+Maj+N dans Chrome / Edge / Brave).
2. Clique sur **Connect** en haut à droite. Tu dois voir un bouton blanc
   **Continue with Google**.
3. Pas de bouton ? Appuie sur **F12**, clique sur l'onglet **Console** et cherche une
   ligne qui commence par **[ZAPR]** :

| Message dans la console | Ce que ça veut dire | Quoi faire |
| --- | --- | --- |
| `NEXT_PUBLIC_PRIVY_APP_ID is not set` | Vercel ne connaît pas la variable | Refais l'étape 5 (vérifie la case **Production**), puis l'étape 6 |
| `doesn't look like a Privy App ID (… got N characters)` | La valeur collée n'est pas un App ID | Recopie l'**App ID** (25 caractères), pas l'App Secret ni l'adresse de la page, puis refais l'étape 6 |
| Aucun message [ZAPR], mais pas de bouton | Le site n'a pas été reconstruit | Refais l'étape 6 et attends **Ready** |

Une valeur fausse ne casse jamais le site : seul le bouton Google disparaît.

## Étape 8 — Les tests à faire ensemble

Fais-les sur l'ordinateur, dans une fenêtre privée. Note ce qui se passe à chaque étape.

**Test 1 — Créer un compte avec Google**
1. **Connect** → **Continue with Google** → choisis ton compte Google.
2. Attendu : retour automatique sur ZAPR, puis la fenêtre « Welcome to the arena » qui
   demande un pseudo. Choisis-en un → **Enter the arena**.
3. Attendu : tu es connecté. En haut à droite s'affiche l'adresse de ton nouveau wallet.

**Test 2 — Lier Phantom à ce compte Google**
1. Dans la même fenêtre : **Settings** → section **Wallets** → **Link a wallet**.
2. Clique sur **Phantom** et accepte dans Phantom (connexion, puis **signer** un message
   gratuit).
3. Attendu : « Wallet linked ». Sous **Wallets** apparaît une ligne **Phantom**.
4. Utilise un compte Phantom qui **n'a jamais servi sur ZAPR**. Sinon c'est refusé,
   et c'est normal.

**Test 3 — Lier Google à un compte Phantom**
1. Dans une **autre** fenêtre privée, connecte-toi avec Phantom (un compte ZAPR existant).
2. **Settings** → **Link a wallet** → **Link Google** → choisis un compte Google
   **qui n'a jamais servi sur ZAPR**.
3. Attendu : retour sur ZAPR, puis « Wallet linked » ; une ligne **Google wallet**
   apparaît sous **Wallets**.
4. Déconnecte-toi, puis **Connect → Continue with Google** : tu dois retrouver
   **le même compte** (même pseudo).

**Test 4 — Exporter le wallet Google**
- Connecté avec Google : **Settings → Export my wallet** → Privy affiche la clé privée.
- **Ne la copie que si tu veux vraiment la mettre dans Phantom**, et ne l'envoie à
  personne, ni à moi.

Si un test ne donne pas le résultat attendu, envoie-moi :
1. une capture de l'écran ;
2. les lignes rouges ou **[ZAPR]** de la console (F12 → Console) ;
3. à quelle étape ça s'est arrêté.

## Dépannage

| Ce que tu vois | Cause probable | Quoi faire |
| --- | --- | --- |
| Google affiche une erreur d'origine / « origin not allowed » | L'adresse du site n'est pas autorisée chez Privy | Étape 3 : `https://v1zapr.vercel.app` exactement |
| Ça marche sur v1zapr.vercel.app mais pas sur une préversion | Normal : Privy refuse les adresses de préversion | Teste sur l'adresse de production |
| « Couldn't create your wallet. Reload the page and try again. » | Privy n'a pas réussi à créer le wallet | Recharge la page. Si ça revient, envoie-moi le message de la console |
| « This wallet already has its own ZAPR account » | Ce Google (ou ce Phantom) a déjà son propre compte ZAPR | Normal : deux comptes ne peuvent pas être fusionnés. Utilise un autre compte Google ou Phantom |
| « Sign in to ZAPR first, then link Google from Settings. » | Ta session ZAPR s'est fermée pendant le passage chez Google | Reconnecte-toi, puis recommence depuis **Settings** |
| Reste bloqué sur « Opening Google… » | Pas de réponse de Privy | Attends 15 s (un message apparaît), vérifie ta connexion, réessaie |

## Bon à savoir

- **Un seul compte pour Google et Phantom** : connecte-toi avec l'un, puis
  **Settings → Wallets → Link a wallet**. Le wallet qui a créé le compte reste celui
  qui **reçoit les zaps**. Tous les wallets liés peuvent **envoyer** des zaps.
- **Deux comptes déjà créés séparément ne peuvent pas être fusionnés.** C'est reporté
  à plus tard.
- Le wallet Google démarre **vide** : en devnet, il faut lui donner des SOL de test
  (page **Wallet** → **Devnet faucet**).
- **Apple** est reporté : ça demande un compte développeur Apple payant et sa propre
  configuration.
- **Coût** : Privy a une offre gratuite pour démarrer, puis devient payant au-delà d'un
  certain nombre d'utilisateurs actifs par mois. Vérifie leurs tarifs actuels sur
  privy.io avant le lancement public.

## Pour le lancement public (plus tard, pas pour la bêta)

Privy recommande d'utiliser **tes propres identifiants Google** en production. Les
personnes voient alors « ZAPR » sur l'écran Google, et tu ne dépends pas des
identifiants partagés de Privy. En résumé :

1. Dans **Google Cloud Console**, crée un « OAuth client » de type **Web application**.
2. Dans **Authorized redirect URIs**, ajoute :
   `https://auth.privy.io/api/v1/oauth/callback`
3. Dans Privy (**Login methods → Socials → Google**), colle le **Client ID** et le
   **Client secret** donnés par Google.
   - Ce *Client secret* va **uniquement** dans Privy, jamais dans Vercel ni dans le
     code.
   - Attention : chez Privy, ça s'applique **tout de suite** à tous les utilisateurs.

On le fera ensemble le moment venu.

## Pour les développeurs : le test automatique avec un faux Privy

```
ZAPR_MOCK_PRIVY=1 NEXT_PUBLIC_PRIVY_APP_ID=cmmockmockmockmockmockmoc \
  NEXT_PUBLIC_SOCIAL_LOGINS=google npx next dev -p 3100
BASE_URL=http://localhost:3100 node tests/browser/link-google.e2e.mjs
```

Le faux Privy (`tests/mocks/`) n'est utilisé que par le serveur de développement avec
`ZAPR_MOCK_PRIVY=1`. Il n'entre jamais dans le site en ligne.
