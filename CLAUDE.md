# ZAPR — contexte pour Claude (lu au début de chaque session)

## Le projet

ZAPR est un réseau social sur **Solana** :
- on publie des posts, les autres les « zappent » avec des SOL ;
- un **zap sur un post** : 70 % au créateur, 30 % à la plateforme ;
- un **zap direct à un créateur** (« Zap this creator ») : 90 % / 10 % ;
- un post vit 24 h, et chaque zap prolonge sa vie, sans plafond ;
- les posts et créateurs les plus zappés montent dans le **Top** (mondial ou par pays, par période).

La **V1 est terminée** : un prototype complet sur **devnet**, en ligne sur https://v1zapr.vercel.app
(dépôt d'origine : `Kayd-Notion/V1-ZAPR`). La suite (V2) part de ce code.

## Comment travailler avec le fondateur (Kayd)

- **Parle en français simple, sans jargon.** Kayd débute en code et travaille sous Windows.
- Quand c'est à lui d'agir, dis **exactement quoi cliquer**, étape par étape.
- L'**interface du site est en anglais (US)**. Les docs pour Kayd sont en français ; celles pour des
  testeurs ou des auditeurs sont en anglais.
- **Ne jamais inventer une décision produit.** Si quelque chose n'a pas été décidé : s'arrêter et
  poser la question.
- **Méthode de travail :**
  - travailler en petits **lots**, une PR par lot ;
  - à chaque lot : tests automatiques **et** un test dans un vrai navigateur (Playwright, Chromium) ;
  - ne fusionner dans `main` qu'un lot dont tous les tests passent et dont le déploiement Vercel est vert ;
  - finir par un résumé fichier par fichier et « comment tester en ligne ».
- Ne jamais dire qu'une chose marche si elle n'a pas été testée en vrai (exemple : la connexion
  Google réelle).

## Règles intouchables

- **Devnet par défaut. Ne jamais activer le mainnet.** Les zaps sont bloqués sur mainnet à quatre
  endroits :
  - l'interface ;
  - `src/lib/pump.ts` ;
  - les routes API (`src/lib/network-guard.ts`) ;
  - le contrôle du réseau du RPC (genesis hash).
- Ne pas changer les répartitions **70/30** et **90/10**, ni le fait que les deux parts partent dans
  la même transaction (atomicité), sans décision explicite.
- **Chaque règle produit est appliquée dans l'interface ET sur le serveur.**
- **Aucune adresse IP stockée.** Les limites anti-spam se font par compte ou par wallet, jamais par IP.
- **Jamais de clé secrète, de mot de passe ou de phrase de récupération** dans le code ou dans les
  messages.
- Ne pas toucher aux fonds ni à l'argent réel.
- Commits : pas d'identifiant de modèle d'IA dans les messages, les PR ou le code.

## Décisions déjà prises

- **Classements :** chaque zap compte pour **100 %** de son montant.
- **Auto-zap** (zapper son propre post, depuis n'importe quel wallet du compte) : autorisé
  **sans conséquence**. Il compte comme un zap normal (durée de vie et classements), **sans badge**.
  Le zap direct à soi-même (« Zap this creator ») reste refusé.
- **Montants rapides :** 0.01 · 0.05 · 0.1 · 0.5 · 1 SOL.
- **Admin :** seulement le wallet `NEXT_PUBLIC_FOUNDER_WALLET`. Pour tous les autres, la page /admin
  n'existe pas (404).
- **Comptes liés :** jusqu'à 5 wallets par compte (Google via Privy, Phantom, un 2ᵉ compte Phantom…).
  - Le wallet de création du compte reçoit les zaps.
  - Pas de fusion de comptes.
- **Reportés (ne pas faire sans accord) :** niveaux de créateurs, fusion de comptes, choix du wallet
  de réception, connexion Apple.
- **Design :** fond bleu nuit sobre (`#0b0f17`) et jaune ZAPR, style pump.fun.

## La technique

- **Base :** Next.js 15 (App Router), React 19, TypeScript, postgres.js (Neon). Hébergé sur Vercel.
- **Stockage :** interface `Store` avec deux versions, Postgres (`src/lib/db/postgres.ts`) et un
  fichier de démo (`src/lib/db/memory.ts`, utilisé quand `DATABASE_URL` est vide).
- **Wallets :** wallet-adapter avec détection automatique (Wallet Standard).
- **Connexion :** une signature de message, puis un cookie de session (JWT).
- **Google :** Privy (`src/components/PrivyBridge.tsx`) ; ZAPR crée lui-même le wallet Solana.
- **Zaps :**
  - la transaction est construite dans le navigateur (`src/lib/pump.ts`) ;
  - le serveur la **vérifie sur la blockchain** avant de l'enregistrer (`src/lib/verify-pump*.ts`).
- **Médias :** Arweave via Irys (`src/lib/irys.ts`).
- **Variables d'environnement :** listées dans `README.md` et `docs/TEST-CHECKLIST.md`.

## Commandes

```
npm install
npm run typecheck && npm run lint && npm test && npm run build
ZAPR_TEST_POSTGRES=1 DATABASE_URL=postgres://… node --import tsx --test --test-force-exit tests/*.test.ts
```

Tests dans un vrai navigateur, à lancer contre un serveur `next dev` ou `next start` (le mode
d'emploi est en tête de chaque fichier) :
- `tests/browser/link-wallets.e2e.mjs` ;
- `tests/browser/link-google.e2e.mjs` (avec un faux Privy, actif seulement si `ZAPR_MOCK_PRIVY=1`) ;
- `tests/browser/rankings.e2e.mjs` ;
- `tests/browser/mobile.e2e.mjs` ;
- `tests/browser/network-guards.e2e.mjs`.

Vrais zaps sur un validateur Solana local : `tests/zap-e2e.local.mts`.

Pièges connus :
- ne pas lancer `next build` pendant qu'un `next dev` tourne : ils partagent `.next` (supprimer
  `.next` entre les deux) ;
- le serveur de dev redémarre quand il manque de mémoire ; pour des tests stables, utiliser
  `next build` puis `next start`.

## Documentation

| Fichier | Contenu |
| --- | --- |
| `README.md` | état complet de la V1 |
| `docs/ZAPR-V1-BRIEF.md` | brief d'origine |
| `docs/TEST-CHECKLIST.md` | tests à la main, sur ordinateur et téléphone |
| `docs/BETA-GUIDE.md` | guide des testeurs (en anglais) |
| `docs/PRIVY-SETUP.md` | activer Google |
| `docs/FEEDBACK-SETUP.md` | activer le bouton Feedback |
| `docs/RPC-SETUP.md` | brancher un RPC payant |
| `docs/AUDIT-PREP.md` | le flux d'argent expliqué pour un auditeur, avec une relecture de sécurité |
| `docs/LEGAL-QUESTIONS.md` | les questions pour un juriste |

## Ce qui reste à faire par Kayd (fin de la V1)

1. Vérifier `SESSION_SECRET` : ligne « Security check » de /admin.
2. Configurer Privy, puis tester la vraie connexion Google ensemble.
3. Tester avec Phantom, sur ordinateur et téléphone.
4. Activer le bouton Feedback et l'adresse de contact.
5. Brancher un RPC payant.
6. Contacter un auditeur et un juriste.

**Décision en attente :** refuser de démarrer le site en production sans `SESSION_SECRET` ? C'est
plus sûr, mais ça bloque la connexion tant que la variable n'est pas posée.
