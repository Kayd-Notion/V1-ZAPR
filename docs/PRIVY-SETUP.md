# Activer « Continue with Google » (et plus tard Apple)

ZAPR utilise **Privy** : la personne se connecte avec son compte Google, Privy lui
crée automatiquement un **wallet Solana** (elle n'a rien à installer), et ZAPR
l'utilise exactement comme Phantom (signature de connexion, zaps, médias).

Tant que `NEXT_PUBLIC_PRIVY_APP_ID` n'est pas renseigné, les boutons n'apparaissent
pas et rien ne change sur le site.

## 1. Créer l'app Privy (10 minutes, gratuit)

1. Va sur **https://dashboard.privy.io** et crée un compte.
2. **Create app** → nom : `ZAPR` → type **Web**.
3. Dans les réglages de connexion (*Login methods*) : active **Google**.
   Laisse les identifiants Google par défaut de Privy pour commencer.
4. Dans les réglages des wallets intégrés (*Embedded wallets*) : active **Solana**.
5. Dans les domaines autorisés (*Allowed domains / origins*) : ajoute
   `https://v1zapr.vercel.app` (et `http://localhost:3000` si tu testes en local).
6. Copie l'**App ID** (il commence en général par `c…`).

## 2. Le mettre dans Vercel

Vercel → projet → **Settings → Environment Variables** → **Add** :

| Key | Value | Type | Environments |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_PRIVY_APP_ID` | l'App ID copié | **Config** | Production (+ Preview si tu veux) |
| `NEXT_PUBLIC_SOCIAL_LOGINS` | `google` | **Config** | idem |

Puis **Deployments → ⋯ → Redeploy** et ouvre **https://v1zapr.vercel.app**.

## 3. Tester

1. Fenêtre privée → **Connect** → **Continue with Google**.
2. Choisis ton compte Google → retour automatique sur ZAPR.
3. ZAPR finit la connexion tout seul (pas de fenêtre Phantom) → choisis un pseudo.
4. **Wallet** → **Devnet faucet** pour recevoir du SOL de test sur ce nouveau wallet.
5. Fais un zap : pas de fenêtre de confirmation en plus, la fenêtre de zap ZAPR suffit.
6. **Settings → Export my wallet** : affiche la clé privée (pour l'importer dans Phantom).

## Apple, plus tard

Apple demande un compte développeur Apple (99 $/an) et sa propre configuration dans
Privy (*Login methods → Apple*). Une fois prêt : `NEXT_PUBLIC_SOCIAL_LOGINS=google,apple`
puis Redeploy. Le bouton noir « Continue with Apple » apparaît.

## Bon à savoir

- Pour avoir **un seul compte** avec Google et Phantom : se connecter avec l'un,
  puis **Settings → Wallets → Link a wallet** → « Link Google » (ou choisir Phantom).
  Les deux ouvrent ensuite le même compte. Le wallet du début reste celui qui reçoit
  les zaps. Attention : si on s'est déjà inscrit séparément avec les deux, ce sont
  deux comptes et ils ne peuvent pas être fusionnés.
- Un App ID mal copié (il fait 25 caractères) est ignoré : les boutons Google
  n'apparaissent pas, le reste du site marche.
- Le wallet Google démarre **vide** : il faut lui envoyer du SOL (faucet en devnet).
- Privy est gratuit au départ, payant au-delà d'un certain nombre d'utilisateurs actifs
  par mois (voir leurs tarifs).
