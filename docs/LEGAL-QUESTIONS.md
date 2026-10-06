# Questions à poser à un juriste (France / UE)

> Document de préparation, à apporter au premier rendez-vous. **Ce n'est pas un avis
> juridique** : ce sont les questions que ZAPR soulève. C'est au juriste d'y répondre.
> Idéalement, un cabinet qui connaît **à la fois** les crypto-actifs (MiCA, AMF) et le
> numérique (RGPD, DSA).

## Ce qu'il faut lui donner

- Ce document, plus `docs/AUDIT-PREP.md` (comment l'argent circule).
- Les brouillons des pages **Terms**, **Privacy** et **Risks** (sur le site, en bas de
  page, ou dans `src/app/terms`, `src/app/privacy`, `src/app/risks`).
- Une démo du site en devnet (https://v1zapr.vercel.app).

## Le résumé à lui expliquer en 1 minute

- ZAPR est un réseau social. Les gens publient des posts, et les autres leur envoient
  des **SOL** (une cryptomonnaie) en « pourboire » (un **zap**).
- **Répartition :**
  - un zap sur un post : **70 %** au créateur, **30 %** à ZAPR ;
  - un zap direct à un créateur : **90 % / 10 %**.
- Un zap prolonge la durée de vie du post et le fait monter dans des **classements**.
- **ZAPR ne détient jamais l'argent :** le paiement va directement du wallet de
  l'utilisateur à ceux du créateur et de ZAPR, en une transaction que l'utilisateur
  signe lui-même.
- **Pas de compte classique :** on se connecte avec son wallet, ou avec Google (un
  prestataire, Privy, crée alors un wallet pour la personne).
- Aujourd'hui, tout tourne sur un **réseau de test** (aucune valeur réelle). Le
  passage à de l'argent réel attend l'audit de sécurité et votre avis.

---

## A. Statut de l'activité (le plus important)

1. Prendre une commission de 30 % (ou 10 %) sur des transferts de crypto-actifs entre
   utilisateurs est-il une **activité réglementée** ?
   - sous **MiCA** (prestataire de services sur crypto-actifs, CASP) : par exemple
     « transfert de crypto-actifs pour le compte de clients » ;
   - ou au titre de l'ancien régime **PSAN** en France ?
2. Le fait d'être **non custodial** compte-t-il ? ZAPR ne détient ni fonds ni clés,
   l'utilisateur signe lui-même, ZAPR construit la transaction dans son navigateur.
   Change-t-il la qualification ?
3. Faut-il un **enregistrement ou un agrément AMF** avant le lancement réel ? Quels
   délais et quels coûts ?
4. **Lutte contre le blanchiment (LCB-FT) :**
   - ZAPR a-t-il des obligations de **KYC** (vérifier l'identité) ?
   - de surveillance des transactions ?
   - de déclaration à **Tracfin** ?
   - La **règle du voyage** (règlement (UE) 2023/1113) s'applique-t-elle ?
5. **Sanctions internationales :** faut-il filtrer certains wallets ou pays ?
6. Un zap peut-il être vu comme un **paiement** relevant de la DSP2 / des services de
   paiement (alors que c'est de la crypto, pas des euros) ?
7. **Les classements :** « payer pour faire monter un post » pose-t-il une question de
   **jeux d'argent** (ANJ) ou de **loterie** ? Il n'y a aucun gain ni tirage, mais
   c'est à confirmer.
8. Si ZAPR ajoute un jour des récompenses (tokens, gains), qu'est-ce que ça
   changerait ? (Rien n'est prévu dans la V1.)

## B. Structure et fiscalité

9. Quelle **structure juridique** pour encaisser des revenus en crypto (micro-entreprise,
   SASU…) ? Une banque acceptera-t-elle ?
10. **TVA :** la commission de 30 % est-elle une prestation de service soumise à TVA ?
    À quel taux, et pour des utilisateurs hors de France ou hors UE ?
11. **Comptabilité :**
    - comment valoriser les SOL reçus (au cours du jour de chaque zap ?) ;
    - comment déclarer le résultat ;
    - comment traiter la conversion en euros.
12. Faut-il **informer les créateurs** de leurs propres obligations fiscales sur les
    zaps reçus ? ZAPR doit-il déclarer quelque chose les concernant (par exemple
    DAC7 / DAC8) ?

## C. Utilisateurs et consommation

13. Juridiquement, un zap est-il :
    - un **don** ;
    - un **achat de service** (de la visibilité, du temps de vie pour le post) ;
    - autre chose ?

    Qu'est-ce que ça implique ?
14. **Droit de rétractation (14 jours)** pour un service numérique exécuté
    immédiatement : faut-il un consentement exprès dans l'interface ?
15. Faut-il des **CGV** en plus des conditions d'utilisation (Terms) ?
16. **Âge minimum :** une simple déclaration « 18 ans et plus » suffit-elle ?
17. Les **limites de responsabilité** des Terms (bugs, pertes) sont-elles valables
    face à des consommateurs français ?

## D. Contenus et plateforme (DSA, LCEN)

18. ZAPR est-il une **« plateforme en ligne »** au sens du **DSA** ? Quelles
    obligations s'appliquent à une petite structure :
    - signalement et retrait ;
    - motivation des décisions de modération ;
    - **point de contact** ;
    - transparence ;
    - représentant légal ?
19. **Mentions légales (LCEN) :**
    - quelles informations publier sur l'éditeur : nom, adresse, statut, directeur
      de la publication ;
    - et sur l'hébergeur (Vercel) ?
    - Peut-on éviter de publier une adresse personnelle ?
20. **Contenus permanents :** les photos et vidéos sont stockées sur **Arweave** et ne
    peuvent pas être supprimées. Comment concilier ça avec :
    - le retrait de contenus illicites (DSA, LCEN) ;
    - le **droit à l'effacement** (RGPD) ?

    Faut-il revoir ce choix technique ?
21. Contenus pédopornographiques ou terroristes : quelles obligations de
    **signalement** (PHAROS, délais) ?
22. **Usurpation de pseudo**, arnaques (faux giveaways) : quelle responsabilité pour
    ZAPR ?

## E. Données personnelles (RGPD)

23. Une **adresse de wallet** est-elle une donnée personnelle ? Les transactions
    publiques sur la blockchain aussi ?
24. ZAPR ne **stocke pas** l'adresse IP, mais il la **lit** au passage pour en déduire
    un code pays. Est-ce un traitement à déclarer, et sur quelle **base légale** ?
25. **Prestataires et transferts hors UE :**
    - Vercel (hébergement), Neon (base de données), **Privy** (connexion Google,
      États-Unis), Irys/Arweave (médias), fournisseur RPC Solana, formulaire de retours.
    - Faut-il des **contrats de sous-traitance (DPA)** ?
    - Des clauses pour les **transferts hors UE** (Data Privacy Framework, clauses
      types) ?
26. **Cookies :** ZAPR n'utilise que des cookies techniques (session, connexion) et un
    peu de stockage local. Faut-il un **bandeau** de consentement ?
27. **Données inscrites sur la blockchain** (impossibles à effacer) : comment
    l'expliquer dans la politique de confidentialité, et est-ce suffisant ?
28. **Durées de conservation :**
    - les zaps sont gardés pour l'historique financier ;
    - les posts expirés sont supprimés ;
    - les comptes, jusqu'à ce que l'utilisateur demande leur suppression.

    Est-ce acceptable ? Faut-il un outil de **suppression de compte** en libre-service ?
29. Faut-il un **DPO** ou un registre des traitements ?

## F. Les pages du site

30. Relire et corriger les brouillons :
    - **Terms** (conditions d'utilisation) ;
    - **Privacy** (confidentialité) ;
    - **Risks** (risques).

    Faut-il les traduire en français pour les utilisateurs français ? Le site est en
    anglais.
31. Quel **droit applicable** et quel **tribunal compétent** indiquer ?
32. Quelle **adresse de contact** publier ? Aujourd'hui, un emplacement provisoire bien
    visible est prévu sur les pages légales. Une adresse e-mail suffit-elle ?
33. Faut-il une page **Mentions légales** séparée (voir question 19) ?

## G. Communication et marque

34. Promouvoir un service crypto (réseaux sociaux, influenceurs) : quelles règles
    (loi influenceurs de 2023, encadrement de la publicité sur les crypto-actifs par
    l'AMF) ?
35. Le nom **« ZAPR »** et le logo : faut-il vérifier les marques existantes et déposer
    la marque (INPI / EUIPO) ?

## H. Pratique

36. Quelles étapes **dans l'ordre** avant d'accepter de l'argent réel, et lesquelles
    peuvent attendre ?
37. **Budget et délais** estimés pour l'accompagnement, et pour un éventuel
    enregistrement auprès de l'AMF.
38. **Assurance :** responsabilité civile professionnelle, cyber-risques ?

---

## Après le rendez-vous

Note pour chaque question : **la réponse**, **l'action à faire** et **le coût ou le
délai**. Envoie-moi les décisions qui changent le site (textes, KYC, suppression de
compte, mentions légales…), et je préparerai les modifications.
