# Brancher un RPC Solana payant (sans toucher au code)

## C'est quoi, et pourquoi

Le **RPC** est le serveur par lequel ZAPR parle à la blockchain Solana : lire un solde,
envoyer un zap, vérifier un zap. Aujourd'hui, ZAPR utilise le RPC **public et gratuit**
de Solana. Il est souvent saturé (zaps lents, « faucet is dry », vérifications qui
échouent). Un fournisseur payant (Helius, QuickNode, Triton, Alchemy…) est plus rapide
et plus fiable. Ces noms sont des exemples, pas une recommandation.

ZAPR a **deux réglages** dans Vercel :

| Variable | Utilisée par | Visible par tout le monde ? | Type Vercel |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SOLANA_RPC` | le **navigateur** des visiteurs (soldes, envoi des zaps) | **Oui** (elle est dans le site) | **Config** |
| `SOLANA_RPC_URL` | le **serveur** (vérification des zaps) | Non, jamais envoyée aux navigateurs | **Secret** (ou « Sensitive ») |

- Si `SOLANA_RPC_URL` est vide, le serveur utilise la même adresse que le navigateur.
- Si les deux sont vides, ZAPR garde le RPC public.

## Sécurité intégrée (rien à faire)

- **Mauvais réseau :** avant chaque zap, ZAPR vérifie que le RPC est bien sur le bon
  réseau (devnet aujourd'hui). Si tu colles par erreur une adresse **mainnet** (vrai
  argent), les zaps sont **refusés** avec le message « Zaps are paused… », au lieu
  d'envoyer de vrais SOL. La page **/admin** l'affiche en rouge.
- **Adresse mal formée :** une adresse qui ne commence pas par `https://` est ignorée
  (ZAPR garde le RPC public).
- **Mainnet :** ZAPR ne s'active **jamais** tout seul. Le passage au mainnet attend
  l'audit (`docs/AUDIT-PREP.md`) et sera une décision séparée.

## Exemple pas à pas avec Helius

Les menus peuvent changer un peu ; cherche les noms les plus proches.

1. Va sur **https://www.helius.dev**, clique sur **Sign up** et crée un compte.
   L'offre gratuite suffit pour la bêta ; regarde les tarifs avant le lancement public.
2. Dans le tableau de bord, ouvre **RPCs** (ou **Endpoints**).
3. Repère l'adresse **Devnet**. Elle ressemble à
   `https://devnet.helius-rpc.com/?api-key=…`. **Pas** celle qui commence par `mainnet`.

### Clé 1 : pour le navigateur (protégée par domaine)

Elle sera visible dans le site. On la limite donc à ton domaine, pour qu'elle ne marche
nulle part ailleurs.

4. Dans **RPCs**, ouvre les règles d'accès (**Access Control** / **Allowed Domains**).
5. Ajoute `https://v1zapr.vercel.app` (et `http://localhost:3000` si tu testes en local).
   Enregistre.
6. Copie l'adresse **Devnet** de cette clé.

### Clé 2 : pour le serveur (secrète, sans restriction de domaine)

Le serveur n'a pas de « domaine ». Une clé limitée par domaine bloquerait donc ses
vérifications.

7. Crée une **deuxième clé** (**API Keys → New key**), **sans** règle de domaine.
8. Copie son adresse **Devnet**.

### Les mettre dans Vercel

9. **https://vercel.com** → projet **v1zapr** → **Settings** → **Environment Variables**.
10. Ajoute :

| Key | Value | Type | Environments |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SOLANA_RPC` | l'adresse de la **clé 1** | **Config** | Production et Preview |
| `SOLANA_RPC_URL` | l'adresse de la **clé 2** | **Secret** | Production et Preview |

11. **Save**, puis **Deployments** → **⋯** sur la première ligne → **Redeploy**.

## Vérifier

1. Ouvre **https://v1zapr.vercel.app/admin** (connecté avec ton wallet fondateur).
2. Ligne **Network** : `Solana devnet · browser RPC devnet.helius-rpc.com · server RPC
   devnet.helius-rpc.com (on the right network).` La clé API n'est jamais affichée.
3. Si la ligne est **rouge** (« is on ANOTHER network ») : tu as collé une adresse
   mainnet. Remplace-la par l'adresse **Devnet**, puis **Redeploy**.
4. Fais un petit zap de test : il doit passer plus vite qu'avant.

## Plus tard, pour le mainnet

Le jour où le mainnet est décidé (après l'audit), il faudra :
- des adresses **mainnet** du fournisseur ;
- `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta`.

Ce n'est **pas** à faire maintenant : aujourd'hui, les zaps restent bloqués sur mainnet,
dans l'interface et sur le serveur.
