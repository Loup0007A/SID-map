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

- **Auth** : connexion avec les comptes existants (`/login`), vérifie le
  `status` du profil comme sur le site 1, redirection auto si non connecté
  (middleware).
- **Carte du monde** (`/carte`) : zones (continents/îles/mers/océans)
  dessinées en polygones colorés, lieux posés dessus (villes, merveilles,
  forêts, déserts...). Clic → panneau latéral avec description, image et
  commentaires. Mode édition admin : tracer une zone point par point,
  poser un lieu, upload d'image.
- **Plan de ville** (`/ville/[id]`) : quartiers en polygones, bâtiments
  (maison/cathédrale/auberge/commerce) posés sur le plan, filtrage par
  quartier. Mode édition admin identique (tracer un quartier, poser un
  bâtiment, assigner un propriétaire en cherchant dans le roster).
- **Bâtiment** (`/batiment/[id]`) : onglets par étage, plan de pièces
  dessinable au clic-glisse (nom + type de pièce), bouton "Vue 3D" qui
  bascule le plan en perspective isométrique (CSS, pas de moteur 3D).
  Le propriétaire d'une maison peut éditer son propre plan sans avoir la
  permission `manage_map` (RLS dédiée).
- Commentaires réutilisables sur zone / lieu / bâtiment.

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
