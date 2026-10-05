# ZAPR

Réseau social crypto sur **Solana** : on publie des posts (texte, photo, vidéo)
et les autres leur envoient des **zaps** en SOL. Chaque zap prolonge la vie du
post et le fait monter dans les classements (posts / créateurs, monde / pays).

- **70 %** au créateur, **30 %** à la plateforme, dans **une seule transaction
  atomique** à deux transferts (ratio réglable, jamais codé en dur).
- Un post vit **24 h**, puis gagne du temps par **mini-paliers** de SOL reçu,
  **sans plafond** (voir « Puissance du zap » plus bas).

> Anciennement « pump.social » (prototype : dépôt `Kayd-Notion/MVP-pump.social`).
> Brief complet du projet : [`docs/ZAPR-V1-BRIEF.md`](docs/ZAPR-V1-BRIEF.md).

> ⚠️ **DEVNET par défaut.** Aucune transaction ne peut toucher du vrai SOL : les
> zaps sont bloqués sur `mainnet` tant qu'un programme on-chain audité n'existe
> pas (`src/lib/pump.ts`).

## État de la V1 (prototype fonctionnel)

Fait : connexion wallet, posts (texte, photo, vidéo, #tags, @mentions),
commentaires, zaps de post (70/30) et de créateur (90/10) vérifiés on-chain,
durée de vie par paliers avec jauge, fil + Following + Live, classements Posts /
Creators, notifications, historique Wallet → Activity, recherche, partage avec
aperçu, suppression, photo de profil, signalements + page Admin (masquer,
bannir), page How it works, pages légales (brouillons), anti-spam, en-têtes de
sécurité, nettoyage quotidien. Test pas à pas : `docs/TEST-CHECKLIST.md`.

Hors V1 (à faire avant du vrai SOL) : programme Solana (Anchor) **audité**,
passage mainnet, relecture juridique des pages légales (+ adresse de contact),
suppression de compte en libre-service. Pistes ensuite : bot Telegram, app
mobile, serveur dédié.

Décisions encore ouvertes : montants rapides (aujourd'hui 0.01 · 0.05 · 0.1 ·
0.5 · 1), classements à 100 % du SOL zappé ou à la part créateur (actuel),
auto-zap dans les classements (compte aujourd'hui), niveaux de créateur.

## Tester en ligne, sans rien installer

Vercel redéploie le site à chaque mise à jour de `main`. Sans base de données,
il tourne avec des **données de démo qui s'effacent**. Pour garder les vrais
posts et zaps, ajoute une base Postgres gratuite :

1. [vercel.com](https://vercel.com) → projet **ZAPR** → onglet **Storage**.
2. **Create Database** → **Neon** → plan gratuit → région Europe (Frankfurt) →
   **Create**, puis **Connect** au projet (tous les environnements).
3. Onglet **Deployments** → dernier déploiement → **⋯ → Redeploy**.

Le site crée ses tables tout seul au premier chargement. La base se consulte
dans le navigateur : Storage → ta base → **Open in Neon** → **SQL Editor**.

### Variables d'environnement (Vercel → Settings → Environment Variables)

| Variable | Valeur | Rôle |
| --- | --- | --- |
| `DATABASE_URL` | posée par Neon | Postgres (sinon données de démo éphémères) |
| `SESSION_SECRET` | 32+ caractères aléatoires | signe les sessions de connexion |
| `PUMP_REQUIRE_ONCHAIN_VERIFY` | vide (défaut), `true` ou `false` | vérification de chaque zap sur Solana : **active par défaut en production**, coupée en local et en preview |
| `NEXT_PUBLIC_PRIVY_APP_ID` | vide, ou l'App ID Privy | active « Continue with Google / Apple » (voir `docs/PRIVY-SETUP.md`) |
| `NEXT_PUBLIC_SOCIAL_LOGINS` | `google` (défaut) ou `google,apple` | boutons affichés quand Privy est actif |
| `CRON_SECRET` | facultatif | protège le nettoyage quotidien (`/api/cron/purge`, appelé par Vercel Cron) |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `devnet` (défaut) | réseau ; `mainnet-beta` bloque les zaps |
| `NEXT_PUBLIC_SOLANA_RPC` | vide ou URL Helius/QuickNode | RPC custom |
| `NEXT_PUBLIC_FOUNDER_WALLET` | adresse devnet du fondateur | reçoit les 30 % ; c'est aussi le **seul admin** (page `/admin`) |
| `NEXT_PUBLIC_PUMP_CREATOR_BPS` / `_FOUNDER_BPS` | `7000` / `3000` | ratio des zaps de post |
| `NEXT_PUBLIC_CREATOR_ZAP_CREATOR_BPS` | `9000` | part créateur des zaps de créateur (le reste va à la plateforme) |
| `NEXT_PUBLIC_IRYS_NETWORK` | `devnet` | upload des médias (Arweave via Irys) |
| `NEXT_PUBLIC_SITE_URL` | vide, ou le domaine ZAPR | liens des aperçus de partage |

## Ce que fait l'app

L'interface est **entièrement en anglais US** (une seule langue, pas de sélecteur) :
textes, messages d'erreur du serveur, nombres (`98.40`), durées (`3d left`,
`2h ago`), message de signature du wallet, image de partage.

- **Connexion wallet** Phantom / Solflare / Backpack (Wallet Standard), preuve
  de propriété par signature d'un message, choix d'un pseudo. Fenêtre façon
  pump.fun : wallets **détectés** d'abord, puis « More wallets » (liens
  d'installation, ou « Open in app » sur téléphone).
- **Continue with Google / Apple** (si `NEXT_PUBLIC_PRIVY_APP_ID` est posé) :
  Privy crée un wallet Solana intégré, enregistré comme un wallet standard ; ZAPR
  l'utilise comme Phantom (même signature de connexion, mêmes zaps vérifiés).
  Export de la clé dans Settings. Privy n'est chargé que s'il est configuré.
  Mise en place : `docs/PRIVY-SETUP.md`.
- **Mode visiteur** : le fil se lit sans wallet (bandeau « You're just watching »).
  À la première visite, une fenêtre « Welcome to ZAPR » résume le concept en
  3 lignes (une seule fois, mémorisé dans le navigateur).
- **How it works** (`/how-it-works`, « Guide » dans le rail) : le concept, la
  répartition 70/30 et 90/10, la durée de vie et les paliers (tableau + jauge
  d'exemple), les classements et une FAQ. Les chiffres sont lus dans la config,
  jamais recopiés.
- **Pages légales** `/terms`, `/privacy`, `/risks` (brouillons de prototype, à
  faire relire par un juriste avant tout lancement public) ; liens en bas de
  chaque page et dans Settings → About. Pages « introuvable » et « erreur »
  aux couleurs de ZAPR.
- **Live permanent** (style pump.fun) : colonne « New / Dying / On fire »
  mise à jour toutes les 4 s, nouveaux posts qui arrivent en direct dans le feed,
  panneau « Top degens ».
- **Posts** texte + photo/vidéo (médias sur Arweave, payés en SOL), commentaires.
  On poste avec le **+** jaune (rail de gauche sur ordinateur, bouton flottant sur mobile).
  Les **#tags** et **@pseudos** sont cliquables (recherche / profil). Le serveur
  n'accepte que des médias hébergés via Irys (`src/lib/media-url.ts`).
- **Partager** : feuille de partage du téléphone, sinon lien copié. Chaque post a
  son **aperçu de partage** (titre « @pseudo on ZAPR », texte, image générée avec
  le total zappé et le temps restant : `src/app/post/[id]/opengraph-image.tsx`).
- **Supprimer** (menu « ⋯ ») : son propre post **tant qu'il n'a reçu aucun zap**
  (après, il reste jusqu'à expiration : ceux qui ont payé gardent ce qu'ils ont
  payé) ; ses commentaires, et les commentaires sous ses posts. Deuxième appui
  pour confirmer ; vérifié côté serveur.
- **Photo de profil** (Settings) : recadrée en 400×400 dans le navigateur, stockée
  sur Arweave (payée en SOL comme les médias), affichée partout ; initiales sinon.
- **Recherche** (loupe) : côté serveur, sur tous les posts vivants (texte, #tag,
  auteur) et les pseudos.
- **Zaps** : montants rapides ou libres, aperçu du 70/30, option d'anonymat.
- **Notifications** (rail de gauche ; cloche en haut sur mobile) : quelqu'un zappe
  un de tes posts, te zappe directement, te suit ou commente un de tes posts.
  Pastille jaune = nombre de nouvelles (vérifié toutes les 30 s) ; ouvrir la
  page les marque comme vues. Tes propres actions ne sont jamais notifiées, et
  un zap anonyme reste anonyme. Calculées à partir des zaps, abonnements et
  commentaires existants (pas de table d'événements en plus).
- **Suivre un créateur** (gratuit) : bouton « Follow » sur son profil, compteurs
  followers / following, onglet **Following** dans le feed (seulement les posts
  des créateurs suivis).
- **Zap this creator** : SOL envoyé directement à un créateur (pas à un post),
  même transaction atomique à deux transferts, partagée **90/10**
  créateur/plateforme. Compte dans le classement **Creators** du Top. Aucun
  effet sur ses posts (ni durée de vie, ni total du post).
- **Signaler** (menu « ⋯ » d'un post, drapeau d'un commentaire) : une raison
  (arnaque, spam, harcèlement, haine, contenu sexuel, illégal, autre) et un
  détail facultatif ; un seul signalement par personne et par contenu.
- **Admin** (`/admin`, lien « Admin » dans le rail et dans Settings, visible
  seulement pour le wallet fondateur, vérifié côté serveur ; pour tout autre
  visiteur, la page et ses API répondent « page introuvable ») :
  chiffres clés (utilisateurs, posts, zaps, SOL zappés, revenus plateforme,
  signalements ouverts), signalements groupés par contenu avec actions en un
  clic (**masquer** le post, **supprimer** le commentaire, **bannir** l'auteur,
  **ignorer**), posts masqués (« Unhide ») et comptes bannis (« Unban »). Un admin
  peut aussi masquer un post depuis son menu « ⋯ ».
- **Post masqué / compte banni** : disparaît de partout (fil, recherche,
  classements, commentaires) ; un compte banni voit un bandeau « suspended » et
  ne peut plus poster, commenter, zapper ni suivre (refusé par le serveur), et
  personne ne peut lui envoyer de zap direct. Un zap déjà en cours de signature
  est quand même enregistré (l'argent est parti).
- **Wallet → Activity** : l'historique de l'argent, du plus récent au plus ancien,
  filtrable (All / Received / Sent) : zaps envoyés (posts et créateurs) et parts
  reçues (70 % d'un zap de post, 90 % d'un zap direct), avec le pseudo de l'autre
  personne (sauf zap anonyme), le post concerné et un lien vers la transaction
  sur l'explorateur Solana. Un auto-zap apparaît des deux côtés.
- **Profil**, **Wallet** (solde devnet + airdrop), **Paramètres** (pseudo, bio,
  confidentialité), **Explorer** (ouvert par la loupe en haut à gauche),
  **Classements** : deux onglets, **Posts** (les posts les plus zappés) et
  **Creators** (les créateurs les plus zappés : leur part des zaps sur leurs
  posts + leur part des zaps reçus directement) ; période All time / 24h /
  7 days / 30 days, monde ou par pays ; thème sombre.

**Puissance du zap (durée de vie d'un post).** Un post naît avec **24 h**. Chaque
zap s'ajoute au total du post ; chaque fois que le total franchit un palier, le
post gagne du temps, **ajouté au temps qui lui reste** :

| Dans chaque SOL (0→1, 1→2, 2→3…), le total atteint | Temps gagné | Cumul dans ce SOL |
|---|---|---|
| x,10 | +3 h | 3 h |
| x,25 | +3 h | 6 h |
| x,50 | +6 h | 12 h |
| SOL entier | +12 h | 24 h |

Un SOL complet vaut donc toujours **+24 h**. Pas de plafond : un post vit
éternellement tant qu'on le zappe. Seul le total compte (découper ses zaps ne
change rien). Montants rapides : 0.01 · 0.05 · 0.1 · 0.5 · 1. La jauge de boost
(fenêtre de zap et page du post) montre la progression et l'effet d'un zap avant
de payer. Tous les chiffres : `src/lib/lifespan-config.ts`.

Règles des zaps, vérifiées **dans l'interface et côté serveur** :

1. **Auto-zap autorisé** (badge « self-zap »), compte normalement.
2. **Post expiré** : il disparaît immédiatement de partout et ne peut plus
   recevoir de nouveau zap. Seul un zap déjà en cours de signature au moment
   de l'expiration est encore enregistré (l'argent est parti) ; s'il atteint un
   palier, il ressuscite le post. Le post est supprimé 10 min après expiration.
3. **Minimum 0,005 SOL** par zap.

**Sécurité.**

- **Vérification on-chain** de chaque zap avant de l'enregistrer (production) :
  bon payeur, bon créateur, bonne répartition (70/30 ou 90/10), bon montant,
  transaction réussie ; une transaction ne compte qu'une fois. Si Solana met du
  temps à la montrer, le serveur réessaie (~12 s) puis répond « pending », et
  l'app réessaie à son tour (`src/lib/record-retry.ts`).
- **Anti-spam** (`src/lib/rate-limit.ts`) : posts 8 / 10 min, commentaires
  30 / 10 min, follows 60 / 10 min, signalements 20 / h, profil 20 / 10 min,
  connexions 10 / 10 min par wallet. Compteurs en base, **par compte ou par
  wallet, jamais par IP**.
- **En-têtes de sécurité** (`next.config.mjs`) : CSP (scripts, styles et polices
  uniquement de ZAPR, pas d'iframe, pas de plugin), HSTS, nosniff,
  Referrer-Policy, Permissions-Policy.
- **Médias** : seules les URL Irys/Arweave sont acceptées.
- **Nettoyage** : posts expirés supprimés au fil de l'eau et chaque nuit (Vercel
  Cron, `vercel.json`).

Règles des zaps de créateur, vérifiées **dans l'interface et côté serveur** :
minimum **0,01 SOL** (les deux parts restent au-dessus du minimum de rente
Solana), **pas de zap à soi-même**, une transaction n'est enregistrée qu'une
fois (ni deux fois comme zap de créateur, ni à la fois comme zap de post).

## Vocabulaire et identité

L'interface parle de **zap**. Le code, l'API (`/api/posts/:id/pump`), la base
(table `pumps`) et les variables (`NEXT_PUBLIC_PUMP_*`) gardent le mot **pump** :
un zap = un pump.

**Identité visuelle** (tirée du logo : éclair jaune plat aux angles francs, avec
une encoche, sur un carré arrondi crème) :

- **Tokens** : toutes les couleurs, arrondis, ombres, lueurs, espacements et
  durées d'animation sont en tête de `src/app/globals.css` (bloc « Tokens ») ;
  le reste du fichier ne fait que les réutiliser. Jaune du logo `#FED202`,
  fond **bleu nuit** sobre `#0B0F17` (bleu désaturé, complémentaire du jaune : il le fait ressortir ; surfaces de la même teinte, dégradé vertical à peine visible ; l'ancien noir `#0A0A0B` est gardé en commentaire dans les tokens), crème `#FEFDF8`. Copie pour les métadonnées :
  `src/lib/brand.ts`.
- **Sombre uniquement** : le thème clair (crème) reste dans le CSS mais est
  désactivé ; pour le remettre, `LIGHT_MODE_ENABLED = true` dans
  `src/lib/brand.ts`.
- **Polices** (hébergées dans `src/app/fonts`, aucun appel à Google) :
  Chakra Petch (titres, logo, boutons, onglets, rangs), Inter (texte),
  JetBrains Mono (montants, scores, wallets).
- **Icônes** : jeu maison dans `src/components/icons/` (trait 2,25 px, angles
  francs, petite découpe en biais) ; l'éclair est celui du logo, **blanc** sur
  les boutons jaunes. Aucun emoji dans l'interface.
- **Formes** : les boutons jaunes ont la découpe de l'éclair (2 coins en biais)
  et une lueur jaune au survol ; avatars en carrés arrondis comme le logo.
- **Logo, favicon, icônes d'app** : `public/brand/` et `src/app/` (générés
  depuis le logo : éclair jaune sur carré crème) ; image de partage
  `src/app/opengraph-image.png`.

## Code

Next.js 15 (App Router) + React 19 + TypeScript. Les routes `/api/*` et le
site sont dans le même projet ; les données passent par `src/lib/db` (Postgres
si `DATABASE_URL`, sinon fichier de démo).

```
src/
  app/                 pages + routes API (/api/*), icônes, image de partage
  components/          AppShell (barre, rail, colonne live), PostCard, LiveColumn, modales…
  components/icons/    jeu d'icônes ZAPR (SVG)
  app/fonts/           polices hébergées localement
  context/             SessionContext (wallet), UIContext (thème, modales, toasts), LiveContext (live)
  hooks/usePump.ts     zap de bout en bout : vérif serveur → signature → envoi → enregistrement
  context/NotificationsContext.tsx  pastille « non lues » (rail + cloche mobile)
  hooks/useCreatorZap.ts  idem pour un zap de créateur (90/10)
  lib/
    pump.ts            transaction du zap — SEUL module à remplacer par le futur programme Anchor
    pump-config.ts     ratios 70/30 et 90/10, minimums, wallet plateforme
    pump-rules.ts      « minimum pour sauver un post expiré »
    pump-errors.ts     erreurs wallet/Solana traduites en messages clairs
    lifespan(-config).ts  puissance du zap : 24 h de base + mini-paliers par SOL
    solana.ts          réseau (devnet par défaut) + garde anti-mainnet
    verify-pump.ts     vérification on-chain d'un zap côté serveur
    db/                Postgres (tables créées automatiquement) + fichier de démo
  db/schema.sql        schéma Postgres
tests/                 tests unitaires (npm test) + tests sur validateur Solana local :
                       pump-send.local.mts (envoi) et zap-e2e.local.mts (vrais zaps vérifiés par le serveur)
docs/TEST-CHECKLIST.md checklist de test pas à pas avec Phantom (devnet)
```

Développeurs, en local :

```bash
npm install
cp .env.local.example .env.local   # défauts sûrs : devnet + données de démo
npm run dev                        # http://localhost:3000
npm run typecheck && npm run lint && npm test && npm run build
```
