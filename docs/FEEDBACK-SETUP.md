# Activer le bouton « Feedback » (retours des testeurs)

Le site a déjà un bouton **Feedback**, en bas de chaque page et dans **Settings**. Il
reste caché tant que tu ne lui as pas donné **où envoyer** les retours. Deux choix,
cumulables :

- **un formulaire en ligne** : le plus pratique pour trier les retours ;
- **une adresse e-mail** : le message s'ouvre prérempli dans la messagerie du testeur.

ZAPR n'envoie rien lui-même et n'ajoute ni adresse IP ni wallet. La fenêtre ajoute
seulement la page, le type d'appareil et l'heure.

## Option A : un formulaire Google Forms (gratuit)

1. Va sur **https://forms.google.com** (connecte-toi avec ton compte Google).
2. Clique sur **+ Formulaire vide**. Titre : `ZAPR beta feedback`.
3. Ajoute ces questions (bouton **⊕** à droite) :
   - « What did you do? » : type **Paragraphe** ;
   - « What happened? » : **Paragraphe** ;
   - « What did you expect? » : **Paragraphe** ;
   - « Page details (paste them from ZAPR) » : **Paragraphe**, facultatif ;
   - « Screenshot » : **Importation de fichier**, facultatif. Google demandera aux
     testeurs de se connecter à Google ; si tu ne veux pas ça, saute cette question.
4. En haut, onglet **Paramètres** → **Réponses** : laisse **désactivé** « Collecter les
   adresses e-mail », pour ne pas collecter de données inutiles.
5. Clique sur **Envoyer** (en haut à droite) → icône **lien (🔗)** → coche
   **Raccourcir l'URL** → **Copier**. Le lien commence par `https://forms.gle/…`.

(Tally, sur https://tally.so, marche pareil : crée le formulaire, puis **Publish** et
copie le lien `https://tally.so/r/…`.)

## Option B : une adresse e-mail

Choisis une adresse que tu consultes, par exemple une adresse dédiée comme
`zapr.beta@…`. Elle sera **visible** sur le site (bouton e-mail et pages légales).

## Mettre la valeur dans Vercel

1. **https://vercel.com** → projet **v1zapr** → **Settings** → **Environment Variables**.
2. Ajoute une variable (ou les deux) :

| Key | Value | Type | Environments |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_FEEDBACK_URL` | le lien du formulaire (`https://…`) | **Config** | Production et Preview |
| `NEXT_PUBLIC_CONTACT_EMAIL` | ton adresse e-mail | **Config** | Production et Preview |

3. **Save**, puis **Deployments** → **⋯** sur la première ligne → **Redeploy**.

## Vérifier

1. Ouvre https://v1zapr.vercel.app → tout en bas de la page : un lien **Feedback**.
2. Clique dessus : la fenêtre montre la page, l'appareil et l'heure, puis les boutons
   **Open the feedback form** et/ou **Email …**.
3. Pas de lien **Feedback** ? Appuie sur **F12** → **Console** et cherche la ligne
   **[ZAPR] The feedback button is off**. Elle veut dire que la valeur manque ou n'est
   pas valable :
   - le lien doit commencer par `https://` ;
   - l'adresse doit être une vraie adresse e-mail.

   Corrige-la, puis refais **Redeploy**.

L'adresse e-mail sert aussi de **contact** dans les pages Terms et Privacy (lot 4).
