# Carte du Monde — S.I.D.

Second site RP connecté au **même projet Supabase** que le site principal.
Aucune donnée existante n'est touchée : tout est additif (nouvelles tables +
1 nouvelle permission `manage_map`).

## Installation

```bash
npm install
cp .env.local.example .env.local
# Remplis .env.local avec les MÊMES clés que le site 1
# (Supabase → Project Settings → API)
npm run dev
```

## Mise en place de la base

1. Ouvre `supabase/migrations/0100_rp_map_schema.sql`.
2. Renomme-le avec le prochain numéro de migration réel du site 1 pour
   garder l'historique propre.
3. Joue-le sur ton projet Supabase (SQL editor, ou `supabase db push` si
   tu utilises la CLI).
4. Donne la permission `manage_map` à ton rôle admin (table
   `role_permissions`), ou coche `is_founder = true` sur ton profil : ça
   suffit à voir apparaître le "Mode édition" sur la carte.

## Interface mobile

Le site utilise désormais les **Pointer Events** (unifiant souris, tactile
et stylet) plutôt que les événements souris seuls, ce qui était
indispensable pour dessiner/naviguer sur la carte depuis un téléphone :
- **Pincement à deux doigts** pour zoomer/dézoomer et se déplacer sur la
  carte du monde, le plan de ville, et le plan des étages.
- `touch-action: none` sur les zones de dessin pour empêcher le
  navigateur d'intercepter le geste (scroll de page pendant qu'on dessine).
- Les barres d'outils d'édition passent en **dock repliable ancré en bas
  de l'écran** (zone du pouce) sur mobile, avec défilement horizontal si
  elles ne tiennent pas, au lieu du panneau flottant en haut-à-gauche du
  bureau. Support des zones sûres iOS (encoche / barre de gestes).
- Cibles tactiles agrandies (boutons de suppression d'étage/pièce,
  toujours visibles au lieu d'apparaître au survol qui n'existe pas au
  tactile), grille d'icônes resserrée pour de plus gros doigts.
- Navbar et panneaux latéraux adaptés (plein écran sur mobile plutôt que
  colonne étroite avec coin arrondi qui ne fait plus sens).

## Ce qui est fonctionnel dans ce scaffold

- **Design** : thème sombre glassmorphism (dégradé de fond, panneaux translucides floutés, coins arrondis), inspiré du site 1 (`sid-quest.vercel.app`).
- **Navigation** : barre de navigation en haut de chaque page (liens, déconnexion), repliable via la flèche ▴/▾ (état mémorisé).
- **Auth** : connexion avec les comptes existants (`/login`), vérifie le `status` du profil comme sur le site 1.
- **Carte du monde** (`/carte`) et **plan de ville** (`/ville/[id]`) :
  - Zoom (molette + boutons) et pan (glisser-déposer), coordonnées de clic fiables (`getScreenCTM`).
  - Formes : polygone, cercle, ellipse, carré, rectangle, trapèze, tracé libre — avec grille d'aide pendant le dessin.
  - Lieux et bâtiments : placement en rond ou rectangle (taille ajustable au clic-glisse puis au curseur), icône personnalisable par lieu.
  - **Mode suppression** (admins) et **légende éditable** : les admins changent l'icône de chaque type directement depuis la légende, et peuvent **ajouter de nouveaux types de bâtiments** (nom + icône) via le bouton "+ Nouveau type".
  - Recherche réelle du roster (nom = colonne `nickname`) pour assigner/réattribuer un propriétaire de maison.
- **Bâtiment** (`/batiment/[id]`) : étages 2D éditables, plus une **vue 3D globale** façon maquette d'architecte (dalles opaques, façade vitrée en grille, pièces visibles en transparence à travers les murs).
- Commentaires réutilisables sur zone / lieu / bâtiment.

## Mise à jour de la base

Trois migrations additives à jouer dans l'ordre (renomme-les avec la
vraie numérotation du site 1) :
1. `0100_rp_map_schema.sql` — schéma de base.
2. `0101_marker_shapes.sql` — taille/forme des marqueurs (rond/rectangle).
3. `0102_icon_config.sql` — icônes éditables + types de bâtiments personnalisés (retire la contrainte fixe sur `city_buildings.type`).



## Limites actuelles / pistes pour la suite

- La "vue 3D" est une perspective CSS simple (isométrique), pas un vrai
  rendu 3D — largement suffisant visuellement pour une cathédrale, mais
  si tu veux du vrai 3D navigable (caméra, étages qu'on traverse), il
  faudrait passer par `three.js` (react-three-fiber), c'est un chantier à
  part.
- Le dessin de polygones est volontairement simple (clic pour poser
  chaque point). On peut ajouter : déplacer un point après coup, undo,
  accrochage sur grille, etc.
- La recherche de propriétaire suppose que `list_roster()` renvoie un
  champ nom lisible (`username`/`pseudo`/`display_name`...) — à vérifier
  contre le vrai retour de la RPC sur ton projet, et ajuster
  `displayName()` dans `BuildingFormModal.tsx` si besoin.
- Pas encore de recherche/filtre global sur la carte du monde (par nom de
  lieu), pas de zoom/pan (la carte est en `viewBox` 0-100, un simple
  zoom/pan SVG peut être ajouté ensuite).
- Pas de suppression/déplacement de zones ou bâtiments existants depuis
  l'UI (uniquement création) — à ajouter si besoin une fois la structure
  validée.

## Arborescence

```
src/
  app/
    login/            connexion
    carte/             carte du monde
    ville/[id]/         plan de ville
    batiment/[id]/       étages d'un bâtiment
  components/
    map/                composants carte du monde
    city/               composants plan de ville
    building/            composants étages/pièces
    ui/                 modal générique
  lib/
    supabase/           clients navigateur/serveur
    hooks/usePermission  vérif permission manage_map
    types.ts             types partagés
supabase/migrations/     schéma SQL additif
```
