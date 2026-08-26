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

## Ce qui est fonctionnel dans ce scaffold

- **Design** : thème sombre glassmorphism (dégradé de fond, panneaux translucides floutés, coins arrondis), inspiré du site 1 (`sid-quest.vercel.app` — vocabulaire "Dossier", couleur `#1b1e27`).
- **Auth** : connexion avec les comptes existants (`/login`), vérifie le `status` du profil comme sur le site 1.
- **Carte du monde** (`/carte`) et **plan de ville** (`/ville/[id]`) :
  - Zoom (molette + boutons) et pan (glisser-déposer), coordonnées de clic fiables (`getScreenCTM`).
  - Formes : polygone (clic par clic, fermeture en recliquant sur le 1er point), cercle, ellipse, carré, rectangle, trapèze, tracé libre — toutes avec grille d'aide à l'alignement pendant le dessin.
  - Lieux (carte du monde) et bâtiments (ville) : placement en **rond** (clic-glisse = rayon) ou en **rectangle** (clic-glisse = largeur/hauteur), taille réajustable dans le formulaire via un curseur ; l'icône s'adapte à la taille choisie.
  - **Mode suppression** (visible uniquement avec la permission `manage_map`) : bascule qui transforme un clic sur zone/lieu/quartier/bâtiment en suppression (avec confirmation).
  - Recherche réelle du roster pour assigner un propriétaire de maison (`OwnerPicker`), réattribuable après coup depuis la fiche du bâtiment.
- **Bâtiment** (`/batiment/[id]`) : étages 2D éditables au clic-glisse, plus une **vue 3D globale** (`Building3DView`) qui empile isométriquement tous les étages avec leurs murs (pas seulement l'étage courant).
- Commentaires réutilisables sur zone / lieu / bâtiment.

## Mise à jour de la base

Deux migrations additives à jouer dans l'ordre (renomme-les avec la
vraie numérotation du site 1) :
1. `0100_rp_map_schema.sql` — schéma de base (zones, lieux, quartiers, bâtiments, étages, commentaires).
2. `0101_marker_shapes.sql` — colonnes `shape`/`radius`/`width`/`height` pour la taille des marqueurs.


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
