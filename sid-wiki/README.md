# Wiki du S.I.D.

Wiki RP (lieux, armes, mobs, objets, skills) branché sur le **même projet Supabase** que le Dossier Central et la Cartographie : mêmes comptes, mêmes rôles.

## Installation

1. `cp .env.example .env.local` et renseigne l'URL + la clé **anon** du projet Supabase existant.
2. Exécute `supabase/migrations/0200_wiki.sql` puis `0201_wiki_hide_names_for_admins.sql` puis `0202_wiki_comments_discoverer.sql` puis `0203_wiki_skills_3d_extras.sql` puis `0204_wiki_save_space.sql` puis `0205_wiki_giga_update.sql` dans le SQL Editor.
3. Donne la permission `manage_wiki` à un rôle (bloc commenté en fin de migration — adapte les noms de colonnes de `role_permissions`). Le Fondateur l'a d'office via `has_permission`.
4. `npm install && npm run dev`

## Fonctionnement

- **Numérotation** : chaque fiche a un numéro 000–999, unique par catégorie.
- **Découverte** : une fiche non découverte s'affiche « ? ». Le masquage est fait **côté base** (RPC `security definer`) : titre, texte, image et tags ne quittent jamais la base pour un non-admin.
- **Admins** (`manage_wiki`) : dashboard `/admin` (découvrir/masquer, éditer, supprimer, tags, images, liens). Sur le wiki, une fiche masquée reste « ? » même pour eux ; ils voient les noms dans le Dashboard.
- **Recherche** : multi-mots, sans accents ni casse, sur titre / résumé / contenu / tags / numéro. Seules les fiches découvertes sont trouvables.
- **Markdown** : GFM (tableaux, listes…), HTML brut désactivé.
- **Liens type Wikipédia** : `[[armes/012]]` ou `[[armes/012|texte]]`, aperçu au survol ; section « Voir aussi » pour les liens explicites.
- **Accès** : compte `active` requis (comme la Cartographie).

## Points à vérifier chez toi

- La migration suppose `public.profiles(id, status)` et `public.has_permission(uuid, text)` comme décrits dans ton résumé.
- L'insertion de `manage_wiki` dans `role_permissions` dépend du schéma réel de cette table.
- **Sections à la Wikipédia** : `##` / `###` dans le contenu deviennent des sections numérotées (1, 1.1…) avec ancres et un sommaire (dès 3 titres).
- **Découvreur** : champ « Découvert par » dans le formulaire admin → « 🏆 Découvert par @pseudo » sur la fiche.
- **Mentions** : `@pseudo` dans le markdown et les commentaires devient une pastille.
- **Commentaires** : en bas des fiches découvertes ; chaque membre actif peut commenter et supprimer les siens, les admins modèrent. Limite : 2000 caractères, 10 par minute.

## Skills et modèles 3D animés

- **Skills** est une 5ᵉ catégorie (✨), avec les mêmes règles que les autres : numéros 000–999, « ? » tant que non découvert, commentaires, recherche…
- N'importe quelle fiche peut avoir un **modèle 3D** : dans le formulaire admin, envoie un fichier **.glb** (50 Mo max avant allègement ; export Blender « glTF 2.0 → glTF Binary », ou Mixamo / Sketchfab). Le formulaire détecte les animations du fichier et te laisse choisir celle à conserver.
- Côté lecteur : rotation à la souris/au doigt, pause/lecture, rotation auto, plein écran, et un sélecteur si le modèle contient plusieurs animations (ex. « Charge », « Impact », « Fin »).
- Un modèle non découvert n'est jamais envoyé aux non-admins (comme le reste de la fiche).

## Autres fonctions

- **Fiche technique** (encadré à la Wikipédia : PV, dégâts, élément, faiblesse…) et **rareté ★** (1–8) par fiche.
- **Favoris** ⭐ personnels (`/favoris`), **fiche au hasard** 🎲 (`/hasard`), navigation **← précédent / suivant →**.
- **Accueil** : dernières découvertes et top des découvreurs.
- **Raccourci** : `/` met le focus sur la recherche.
- **Historique des versions** : chaque modification est sauvegardée (50 versions par fiche) ; « Restaurer » recharge une ancienne version dans le formulaire.
- **Dashboard** : sélection multiple (découvrir / masquer / supprimer en masse), **export** et **import JSON** par catégorie.

## Téléphone et installation

- **Mobile first** : sous 768 px, barre d'onglets en bas (Accueil, Chercher, Favoris, Hasard, Menu), menu coulissant avec les 5 catégories, cartes en 2 colonnes, tableaux markdown défilables, infobulles gardées dans l'écran, boutons de 40 px minimum, champs en 16 px (pas de zoom iOS), barre « Enregistrer » collée en bas dans l'éditeur.
- **Installable (PWA)** : « Ajouter à l'écran d'accueil » (Android : menu ⋮ → Installer l'application ; iPhone : Partager → Sur l'écran d'accueil). Manifest dans `src/app/manifest.ts`, icônes dans `public/icons/` (remplace-les par les tiennes si tu veux).
- Pas de mode hors-ligne pour l'instant.

## Look & économie d'espace

- **Thème** : fond noir, vagues bleues transparentes animées + bulles (100 % CSS, désactivées si le système demande moins de mouvement ; 2 vagues et les bulles masquées sur téléphone), cartes en verre, titres dégradés, apparition en fondu des pages et des cartes.
- **En-tête ordinateur** : logo, grande barre de recherche centrée (raccourci `/`), accès favoris / hasard / admin / déconnexion, et onglets des catégories avec l'onglet actif souligné.
- **Modèles 3D allégés** : à l'enregistrement, le site ne garde que l'animation (« action » Blender) choisie et supprime les autres et les caméras. Il **ne touche ni aux matériaux ni aux textures**. Si le fichier utilise une extension glTF que l'outil ne sait pas conserver, une confirmation est demandée (sinon l'envoi se fait avec le fichier d'origine intact).
- **Fichiers .fbx** : acceptés dans le formulaire (Mixamo, Blender…). Le site les convertit en .glb dans ton navigateur (matériaux en PBR standard, textures intégrées au FBX conservées, toutes les animations listées pour que tu choisisses), puis applique le même allègement. Les textures *externes* (fichiers à côté du .fbx) ne sont pas lues : exporte avec « Embed Textures » ou utilise le .glb. Les shaders Blender personnalisés ne passent pas non plus en FBX : bake en texture.
- **Matériaux Blender** : l'export glTF ne conserve que le *Principled BSDF* (couleur, métal, rugosité, émission, textures branchées dessus). Un shader personnalisé en nœuds apparaît blanc : « bake » le rendu en texture et branche-la sur Base Color / Emission avant d'exporter.
- **Nettoyage du stockage** : ancien modèle, anciennes images et brouillons sont supprimés au remplacement ; supprimer une fiche (Dashboard) supprime aussi son image et son modèle.
- **Images** : réduites automatiquement avant envoi (WebP, 1600 px max).
- **Limites** (migration 0204) : modèles 10 Mo, images 3 Mo, 20 versions d'historique par fiche.


## Compatibilité anciens iPhone (iOS 15)

- Un correctif (`patches/`, appliqué automatiquement par `npm install` via `patch-package`) retire une syntaxe d'expression régulière de `mdast-util-gfm-autolink-literal` que Safari < 16.4 ne sait pas lire (elle faisait planter les pages avec du texte : « a client-side exception has occurred »).
- De petits polyfills (`Object.hasOwn`, `.at()`, `findLast`, `structuredClone`) sont chargés dans `src/app/layout.tsx` pour iOS 15.0–15.3.

## Grosse mise à jour (migration 0205)

**Pour tout le monde**
- 📝 **Notes personnelles** privées sous chaque fiche (5000 caractères), regroupées dans « Mes favoris et notes ».
- 🕘 **Consultées récemment** (sur l'appareil) et 🆕 **« N nouvelles découvertes depuis ta dernière visite »** sur l'accueil.
- ▦/☰ **Cartes ou liste**, **tri** (numéro, nom, rareté ★) et **filtre instantané** dans chaque catégorie (le choix est mémorisé). Les fiches masquées restent « ? ».
- 🔗 **Partager** (menu de partage du téléphone ou lien copié), 🖨 **Imprimer** (mise en page propre, noir sur blanc), **A− / A+** pour la taille du texte.
- 🚩 **Signaler** une erreur, une info manquante ou une idée directement aux admins (anti-spam : 5 par 10 min).
- 🏷 **Page des tags** (`/tags`) : tous les tags avec leur nombre de fiches découvertes.
- 📣 **Annonce d'accueil** écrite par les admins.

**Pour les admins** (Dashboard, 3 onglets)
- 📚 **Fiches** : cartes de stats, filtre **À compléter** (résumé, texte, image, tags, fiche technique, découvreur manquants, avec pastille ⚠), compteurs 💬 commentaires / ⭐ favoris / 🚩 signalements par fiche, **Dupliquer** (copie masquée au prochain numéro libre, sans image ni modèle), **ajout / retrait d'un tag en masse** sur la sélection.
- 🚩 **Signalements** : boîte de réception (traiter, rouvrir, supprimer, éditer la fiche), pastille rouge du nombre à traiter.
- ⚙ **Réglages** : publier / retirer l'annonce d'accueil.

## Icônes, guide et interface simplifiée

- **Icônes personnalisées** : dépose des PNG transparents (128×128) dans `public/icons/` avec les noms listés dans `public/icons/LISEZ-MOI.txt` (`logo`, `lieux`, `armes`, `mobs`, `objets`, `skills`, `accueil`, `chercher`, `favoris`, `hasard`, `tags`, `aide`, `admin`, `menu`). Un fichier absent = l'emoji par défaut. Les icônes de l'appli installée (`icon-192`, `icon-512`, `icon-maskable-512`, `apple-touch-icon`) se remplacent de la même façon.
- **Mini-guide** : page `/aide` (menu → Aide), bandeau « Première visite ? » sur l'accueil ; une section « Pour les admins » n'apparaît qu'aux admins.
- **Interface allégée** : ordinateur = logo, recherche, ⭐ et un seul menu (hasard, tags, aide, admin, déconnexion) ; téléphone = 3 onglets + Menu ; fiche = ⭐ Favori + un bouton ⋯ (partager, imprimer, taille du texte) et « Signaler » discret en bas ; catégorie = filtres secondaires repliés ; accueil sans doublon de recherche, top découvreurs repliable ; Dashboard = stats sur une ligne et actions rares (dupliquer, supprimer) dans un menu ⋯.
