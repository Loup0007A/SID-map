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

## Système de position & routes (nouveau)

- **"Ma position"** : chaque membre peut indiquer où se trouve son
  personnage — soit à un lieu (avec précision du bâtiment si c'est une
  ville), soit en train de voyager sur une route (curseur % d'avancement),
  soit une note libre ("quelque part dans les Terres Perdues"). Bouton
  "📍 Ma position" en bas à droite sur la carte du monde et sur chaque
  plan de ville. Chacun choisit s'il est visible des autres.
- **Affichage en temps réel** : les positions se mettent à jour chez
  tout le monde instantanément via Supabase Realtime (table
  `character_positions`), sans recharger la page. Pastilles vertes
  groupées par lieu sur la carte du monde, badges de comptage sur les
  bâtiments concernés en ville, voyageurs affichés en mouvement le long
  des routes.
- **Panneau "Présences"** : liste tous les membres visibles et leur
  position actuelle (avec horodatage relatif), cliquable pour recentrer
  sur le lieu correspondant.
- **Routes** (admins, `manage_map`) : nouvel outil "🛣 Route" sur la
  carte du monde — clique un lieu de départ, ajoute des points
  intermédiaires si besoin, clique un lieu d'arrivée pour terminer.
  Nom, couleur et temps de trajet RP optionnels. Supprimable en mode
  suppression comme le reste.

## Autres améliorations de cette session

- **Notifications toast** : retour visuel discret (succès/erreur) sur
  les sauvegardes, suppressions, et la mise à jour de position.
- **PWA installable** : manifeste + icônes (`/manifest.webmanifest`),
  le site peut être ajouté à l'écran d'accueil d'un téléphone comme une
  vraie application.
- **Accessibilité** : anneau de focus clavier visible sur tous les
  éléments interactifs, respect de la préférence système "réduire les
  animations" (désactive le dégradé animé du bandeau).

## Ajouts créatifs de cette session

Note honnête d'abord : je n'ai pas d'outil de navigateur pilotable dans
mon environnement (pas de clic/remplissage de formulaire sur un site
externe), et mon bac à sable de code n'a pas accès réseau à vercel.app
ni supabase.co. Je n'ai donc pas pu me connecter avec les identifiants
fournis ni tester l'interface en direct — tout ce qui suit a été conçu
et testé (build complet) directement dans le code, comme les fois
précédentes.

- **Contrôle territorial** : les zones et les lieux peuvent être
  rattachés à un groupe/faction existant (table `groups` du site 1) et
  affichent un petit drapeau 🏴 sur la carte. Sélecteur dans la fiche
  de détail (admins). Colle bien au thème "régime dictatorial" de la
  S.I.D. — visualise qui contrôle quoi.
- **Missions localisées** : les quêtes du site 1 qui ont une
  localisation (nouvelle colonne `place_id`, optionnelle) apparaissent
  comme des pastilles 📜 cliquables sur la carte, avec un lien vers le
  site principal pour postuler.
- **Planificateur de trajet** (🧭 Itinéraire) : calcule le plus court
  chemin entre deux lieux à travers le réseau de routes existant
  (algorithme de Dijkstra), affiche le temps de trajet RP total et
  surligne l'itinéraire en vert sur la carte.
- **Recherche de lieux** : barre de recherche en haut de la carte du
  monde, centre et sélectionne le résultat choisi.
- **Liens partageables** : sélectionner un lieu met à jour l'URL
  (`?lieu=...`) — un lien copié-collé dans Discord rouvre la carte
  directement centrée sur ce lieu.
- **Export en image** : bouton "🖼 Exporter" qui télécharge la vue
  actuelle de la carte du monde en PNG (pratique pour partager un
  aperçu hors-ligne).

Nouvelle migration additive : `0104_territory_and_quests.sql`. Les deux
nouvelles fonctions SQL détectent automatiquement le nom réel des
colonnes (nom du groupe, titre de la quête) via `information_schema`
au lieu de le deviner, et s'exécutent en **SECURITY INVOKER** (donc
respectent exactement les permissions/RLS déjà en place sur `groups` et
`quests` — aucun contournement de confidentialité).

## Voyage réel, montures, relief/biomes, lieux-bâtiments (session majeure)

**⚠️ Hypothèses à vérifier avant de jouer la migration 0105 :**
- Je pars du principe que `quest_participants` a des colonnes `quest_id`
  et `user_id`. Si ce n'est pas le cas, `check_quest_arrival()` échouera
  silencieusement (elle ne casse rien, mais ne validera rien non plus).
- La validation automatique appelle `validate_quest_participant(quest_id, user_id)`
  qui existe déjà sur le site 1. Si cette fonction est réservée aux
  admins (vérification de permission interne), l'appel par un joueur
  échouera proprement — dis-le-moi et j'ajouterai un chemin dédié.
- Je ne touche **que** la colonne `balance` de `wallets`, toujours en
  `UPDATE` (jamais `INSERT`), donc aucun risque sur ses autres colonnes.

**Fin de la téléportation** — Plus aucune écriture libre de
`character_positions` n'est permise côté client (les policies RLS qui le
permettaient sont supprimées par la migration). Tout changement de lieu
passe par `start_journey()` / `arrive_at_destination()`, qui calculent et
revalident le temps de trajet **côté serveur** : impossible de tricher en
rappelant la fonction trop tôt ou en bricolant une requête directe. Seule
exception : le tout premier positionnement (`set_initial_place`), qui
n'est permis que si aucun lieu n'est encore défini.

**Statut dissocié du lieu** — Un champ `status` libre ("disponible pour
du RP", "dort"...), modifiable à tout moment via `set_character_status()`,
indépendamment d'où se trouve le personnage.

**Montures** — Les admins créent des types de montures (icône, vitesse,
vol ou non, prix) et les proposent à la location sur n'importe quel lieu,
depuis sa fiche de détail. Louer déduit le prix du portefeuille du
joueur et crédite **50 %** à l'admin propriétaire du point de location
(l'autre moitié est retirée de la circulation, comme une taxe, pour ne
pas gonfler l'économie). La monture active accélère tous les trajets
(route ou vol direct si elle vole).

**Relief et biomes** — Deux nouvelles couches activables indépendamment
(boutons 🏔/🌿 dans le coin bas-droit), éditables par les admins via les
mêmes outils de dessin que le reste (onglets Carte/Relief/Biomes dans la
barre d'édition).

**Lieux-bâtiments** — N'importe quel lieu (pas seulement une ville) peut
être marqué "bâtiment éditable" depuis sa fiche, avec ses propres étages
à `/lieu/[id]`. Sous-sols via le bouton "+ Sous-sol" (numéros négatifs),
et les pièces de type "Escalier" peuvent indiquer l'étage auquel elles
mènent — cliquer dessus en vue à plat y navigue directement.

**Quêtes validées par présence** — Si un personnage reste 1h sur le lieu
d'une quête à laquelle il participe, elle se valide automatiquement
(vérifié chaque minute en arrière-plan, affiche un compte à rebours).

## Mise à jour de la base

Quatre migrations additives à jouer dans l'ordre (renomme-les avec la
vraie numérotation du site 1) :
1. `0100_rp_map_schema.sql` — schéma de base.
2. `0101_marker_shapes.sql` — taille/forme des marqueurs (rond/rectangle).
3. `0102_icon_config.sql` — icônes éditables + types de bâtiments personnalisés.
4. `0103_positions_routes.sql` — routes + positions des personnages,
   active Supabase Realtime sur ces deux tables.
5. `0104_territory_and_quests.sql` — contrôle territorial (factions) +
   quêtes localisées sur la carte.
6. `0105_travel_mounts_layers.sql` — voyage réel sans téléportation,
   statut dissocié, montures louables, relief, biomes, lieux-bâtiments
   (sous-sols/escaliers), validation de quête par présence.



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

## Migration 0106 — quêtes terminées, marchés noirs, cristaux

- `quest_is_finished(status)` : les quêtes dont le statut est « validée / terminée / annulée… » disparaissent de la carte et ne sont plus revalidées. **Vérifie/ajuste la liste des statuts** dans cette fonction (et `FINISHED_STATUSES` dans `src/lib/types.ts`) selon les vraies valeurs de `quests.status`.
- Marchés noirs : les admins cochent « Autoriser les marchés noirs » sur un lieu ; les joueurs présents sur place ouvrent un étal, y mettent des articles (prix, stock). L'achat passe par `buy_black_market_item` : 10 % de commission, répartis entre fondateurs / `manage_map`. Seul `wallets.balance` est modifié (UPDATE).
- Cristaux de téléportation : bouton « 💎 Cristaux » sur la carte. Les admins en donnent (départ → arrivée, usage unique ou continu) ; le joueur l'utilise uniquement depuis le lieu de départ (`use_teleport_crystal`).
- Les infobulles de quêtes et de présence sont maintenant des panneaux HTML de taille fixe ; la modale « Ma position » est plus étroite (`max-w-sm`).

## Migration 0107 — textures de carte

- Table `map_textures` (motif, couleur, fond, taille, opacité, rotation, quinconce) + colonne `texture_id` (texte) sur `map_biomes`, `map_relief`, `map_zones`. `texture_id` vaut `NULL` (auto selon le type), `'none'`, `'builtin:xxx'` (12 préréglages intégrés) ou l'uuid d'une texture personnalisée.
- Les admins créent des textures depuis le sélecteur de texture (formulaires Biome/Relief) : 12 motifs (montagne, sapin, arbre, vagues, herbe, cactus, flocon…) ou n'importe quel emoji. En mode édition, un clic sur un biome/relief existant permet de changer sa texture.
- Optimisations : rendu par `<pattern>` SVG (une tuile répétée par le navigateur, aucune image), motifs définis seulement s'ils sont utilisés, calque mémoïsé (pas recalculé pendant zoom/déplacement), textures personnalisées mises en cache à la session, éditeur chargé à la demande (`next/dynamic`), colonnes ciblées dans les requêtes, tracés simplifiés + arrondis à 2 décimales à l'enregistrement (moins de stockage).

## Migration 0108 — textures dessinées + fond

- Les textures peuvent être **dessinées à la main** (motif « ✏️ Dessin libre » : traits, formes pleines, gomme, annuler) dans une tuile qui se répète sur le terrain.
- Une texture porte aussi la **couleur de fond** (et son opacité) : quand un biome/relief a une texture avec fond, elle remplace entièrement sa couleur. Les préréglages ont tous un fond.
- Les textures personnalisées sont modifiables/supprimables ; un préréglage peut être dupliqué (✎) puis modifié.

## Migration 0109 — échelle de la carte et vol

- Table `map_settings` (1 unité de carte = X km, vitesse de marche). L'échelle graphique en bas à gauche suit le zoom ; les admins cliquent dessus pour la régler.
- Les montures qui volent peuvent avoir une **vitesse de vol (km/h)** et une **portée maximale (km)** (facultatives). Temps de vol = distance ÷ vitesse, calculé côté serveur dans `start_journey`.
- « Ma position » affiche la distance et la durée vers chaque destination, et grise celles hors de portée.
- Hauteur d'écran : `100dvh` (la barre du navigateur ne masque plus le haut/bas) et les fenêtres modales s'adaptent à l'écran.

## Migration 0110 — correctif montures / voyages

`list_active_positions` (0103) ne renvoyait pas `active_mount_id`, `travel_*`, `status`, `arrived_at`, `flight_target_place_id` : la monture louée n'apparaissait donc jamais comme équipée. Redéfinie complète. Ajout de `unequip_mount()` (bouton « Descendre »).

## Migration 0111 — location 24 h, stats, biomes traversables

- Une location de monture dure `rental_hours` (24 h par défaut, réglable par monture) ; ensuite la monture disparaît (côté serveur aussi). Journal `mount_rental_log` pour les stats.
- Bouton « 🐎 Montures » : onglet « Ma monture » (temps restant) et « 📊 Stats » (vitesse, portée, prix, durée, biomes, nombre de locations ; les admins voient aussi les revenus et peuvent créer/modifier/supprimer).
- Monture volante = vol libre vers n'importe quel lieu, sans chemin (liste triée par distance).
- Biomes traversables (optionnel, par monture) : vérifié côté serveur sur les routes et les vols en ligne droite ; l'interface grise les trajets interdits.
