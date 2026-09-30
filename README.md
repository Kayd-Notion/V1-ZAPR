# ZAPR

Réseau social crypto sur **Solana** : on publie des posts (texte, photo, vidéo)
et les autres leur envoient des **zaps** en SOL. Chaque zap prolonge la vie du
post et le fait monter dans les classements (posts / créateurs, monde / pays).

- **70 %** au créateur, **30 %** à la plateforme, dans **une seule transaction
  atomique** à deux transferts (ratio réglable, jamais codé en dur).
- Un post vit **24 h**, puis gagne du temps selon le SOL reçu, **sans plafond**.

> Anciennement « pump.social » (prototype : dépôt `Kayd-Notion/MVP-pump.social`).
> Brief complet du projet : [`docs/ZAPR-V1-BRIEF.md`](docs/ZAPR-V1-BRIEF.md).

> ⚠️ **DEVNET par défaut.** Aucune transaction ne peut toucher du vrai SOL : les
> zaps sont bloqués sur `mainnet` tant qu'un programme on-chain audité n'existe
> pas (`src/lib/pump.ts`).

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
| `PUMP_REQUIRE_ONCHAIN_VERIFY` | `true` | le serveur vérifie chaque zap sur Solana |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | `devnet` (défaut) | réseau ; `mainnet-beta` bloque les zaps |
| `NEXT_PUBLIC_SOLANA_RPC` | vide ou URL Helius/QuickNode | RPC custom |
| `NEXT_PUBLIC_FOUNDER_WALLET` | adresse devnet du fondateur | reçoit les 30 % |
| `NEXT_PUBLIC_PUMP_CREATOR_BPS` / `_FOUNDER_BPS` | `7000` / `3000` | ratio des zaps de post |
| `NEXT_PUBLIC_CREATOR_ZAP_CREATOR_BPS` | `9000` | part créateur des zaps de créateur (le reste va à la plateforme) |
| `NEXT_PUBLIC_IRYS_NETWORK` | `devnet` | upload des médias (Arweave via Irys) |
| `NEXT_PUBLIC_SITE_URL` | vide, ou le domaine ZAPR | liens des aperçus de partage |

## Ce que fait l'app

L'interface est **entièrement en anglais US** (une seule langue, pas de sélecteur) :
textes, messages d'erreur du serveur, nombres (`98.40`), durées (`3d left`,
`2h ago`), message de signature du wallet, image de partage.

- **Connexion wallet** Phantom / Solflare / Backpack (Wallet Standard), preuve
  de propriété par signature d'un message, choix d'un pseudo.
- **Mode visiteur** : le fil se lit sans wallet (bandeau « You're just watching »).
- **Live permanent** (style pump.fun) : colonne « New / Dying / On fire »
  mise à jour toutes les 4 s, nouveaux posts qui arrivent en direct dans le feed,
  panneau « Top degens ».
- **Posts** texte + photo/vidéo (médias sur Arweave, payés en SOL), commentaires.
  On poste avec le bouton **Post** (en haut) ou le **+** (rail / mobile).
- **Zaps** : montants rapides ou libres, aperçu du 70/30, option d'anonymat.
- **Suivre un créateur** (gratuit) : bouton « Follow » sur son profil, compteurs
  followers / following, onglet **Following** dans le feed (seulement les posts
  des créateurs suivis).
- **Zap this creator** : SOL envoyé directement à un créateur (pas à un post),
  même transaction atomique à deux transferts, partagée **90/10**
  créateur/plateforme. Classement dédié **Zapped** dans le Top. Aucun effet sur
  ses posts (ni durée de vie, ni total du post, ni classement « Degens »).
- **Profil**, **Wallet** (solde devnet + airdrop), **Paramètres** (pseudo, bio,
  confidentialité), **Explorer** (recherche, ouverte par la loupe en haut à gauche),
  **Classements** (période All time / 24h / 7 days / 30 days), thème sombre / clair.

Règles des zaps, vérifiées **dans l'interface et côté serveur** :

1. **Auto-zap autorisé** (badge « self-zap »), compte normalement.
2. **Post expiré** : il faut au moins le montant qui le sauve (≥ 1 h de vie en
   plus) ; le serveur revérifie juste avant la signature.
3. **Minimum 0,005 SOL** par zap.

Règles des zaps de créateur, vérifiées **dans l'interface et côté serveur** :
minimum **0,01 SOL** (les deux parts restent au-dessus du minimum de rente
Solana), **pas de zap à soi-même**, une transaction n'est enregistrée qu'une
fois (ni deux fois comme zap de créateur, ni à la fois comme zap de post).

## Vocabulaire et identité

L'interface parle de **zap**. Le code, l'API (`/api/posts/:id/pump`), la base
(table `pumps`) et les variables (`NEXT_PUBLIC_PUMP_*`) gardent le mot **pump** :
un zap = un pump.

Jaune électrique `#FED202` (texte noir dessus), crème `#FDFBF4`, jaune foncé
`#8A6D00` pour le texte jaune en thème clair — variables dans
`src/app/globals.css`. Logo : `public/brand/zapr-icon.svg` et `zapr-bolt.svg` ;
favicon, icônes et image de partage dans `src/app/`. Icônes de l'interface :
[lucide-react](https://lucide.dev) (aucun emoji dans l'interface).

## Code

Next.js 15 (App Router) + React 19 + TypeScript. Les routes `/api/*` et le
site sont dans le même projet ; les données passent par `src/lib/db` (Postgres
si `DATABASE_URL`, sinon fichier de démo).

```
src/
  app/                 pages + routes API (/api/*), icônes, image de partage
  components/          AppShell (barre, ticker, rail, colonne live), PostCard, LiveColumn, modales…
  context/             SessionContext (wallet), UIContext (thème, modales, toasts), LiveContext (live)
  hooks/usePump.ts     zap de bout en bout : vérif serveur → signature → envoi → enregistrement
  hooks/useCreatorZap.ts  idem pour un zap de créateur (90/10)
  lib/
    pump.ts            transaction du zap — SEUL module à remplacer par le futur programme Anchor
    pump-config.ts     ratios 70/30 et 90/10, minimums, wallet plateforme
    pump-rules.ts      « minimum pour sauver un post expiré »
    pump-errors.ts     erreurs wallet/Solana traduites en messages clairs
    lifespan(-config).ts  paliers de durée de vie
    solana.ts          réseau (devnet par défaut) + garde anti-mainnet
    verify-pump.ts     vérification on-chain d'un zap côté serveur
    db/                Postgres (tables créées automatiquement) + fichier de démo
  db/schema.sql        schéma Postgres
tests/                 tests unitaires (npm test) + pump-send.local.mts (validateur local)
```

Développeurs, en local :

```bash
npm install
cp .env.local.example .env.local   # défauts sûrs : devnet + données de démo
npm run dev                        # http://localhost:3000
npm run typecheck && npm run lint && npm test && npm run build
```
