// =====================================================================
// Contenu de l'accompagnement : visite guidée, check-lists de démarrage
// et fiches d'aide. Tout le texte vit ici pour pouvoir le corriger sans
// toucher aux composants.
//
// Une étape de visite vise un élément de l'interface portant l'attribut
// data-guide="<target>". Si l'élément est absent (barre repliée, écran
// trop petit…), l'étape s'affiche simplement au centre de l'écran.
// =====================================================================

export type Audience = 'player' | 'admin';

export interface TourStep {
  id: string;
  target?: string; // valeur de data-guide
  title: string;
  body: string;
}

export const PLAYER_TOUR: TourStep[] = [
  {
    id: 'welcome',
    title: 'Bienvenue sur la carte du monde',
    body: 'Une visite d’une minute pour savoir où cliquer. Tu pourras la relancer à tout moment depuis le bouton « ? Aide ».'
  },
  {
    id: 'navigate',
    target: 'zoom',
    title: 'Se déplacer sur la carte',
    body: 'Glisse pour bouger, molette ou pincement à deux doigts pour zoomer. Ces boutons font la même chose ; la flèche ⤾ recadre toute la carte.'
  },
  {
    id: 'search',
    target: 'search',
    title: 'Trouver un lieu',
    body: 'Tape le nom d’un lieu : la carte se centre dessus et sa fiche s’ouvre (description, montures à louer, commentaires). Tu peux aussi cliquer directement un lieu ou une région.'
  },
  {
    id: 'apps',
    target: 'apps',
    title: 'Tout part des Applications',
    body: '« Ma position » pour placer ton personnage et voyager, « Montures », « Itinéraire », « Cristaux »… Commence par « Ma position » : tant qu’elle n’est pas fixée, tu ne peux pas voyager.'
  },
  {
    id: 'layers',
    target: 'layers',
    title: 'Calques',
    body: 'Affiche ou masque le relief, les biomes et les textures. Les biomes comptent : certaines montures ne peuvent pas les traverser.'
  },
  {
    id: 'presence',
    target: 'presence',
    title: 'Qui est où ?',
    body: '« Présences » liste les personnages visibles et leur position, en direct. « Légende » rappelle ce que veut dire chaque icône.'
  },
  {
    id: 'help',
    target: 'help',
    title: 'Besoin d’un rappel ?',
    body: 'Le bouton « ? Aide » regroupe ta check-list de démarrage, les fiches explicatives et cette visite.'
  }
];

export const ADMIN_TOUR: TourStep[] = [
  {
    id: 'admin-intro',
    title: 'Côté administration',
    body: 'Tu as la permission de modifier la carte. Voici les quatre choses à connaître ; l’ordre conseillé pour construire le monde est dans « ? Aide → Démarrer ».'
  },
  {
    id: 'admin-toolbar',
    target: 'edit-toolbar',
    title: 'La barre d’outils',
    body: 'Active le « Mode édition », puis choisis un calque : Carte (régions, lieux, routes), Relief ou Biomes. Ce que tu dessines va dans le calque sélectionné.'
  },
  {
    id: 'admin-draw',
    target: 'edit-toolbar',
    title: 'Dessiner',
    body: 'Formes = régions (ou zones de relief/biome). « Lieu » = une ville, un donjon… « Route » relie deux lieux : clique le lieu de départ, des points intermédiaires, puis le lieu d’arrivée. Un bandeau te rappelle le geste attendu à chaque outil.'
  },
  {
    id: 'admin-delete',
    target: 'edit-toolbar',
    title: 'Supprimer sans se tromper',
    body: 'Le « Mode suppression » ne touche que le calque sélectionné, et demande toujours confirmation. Pense à le désactiver ensuite : tant qu’il est actif, chaque clic propose une suppression.'
  },
  {
    id: 'admin-scale',
    target: 'scale',
    title: 'Échelle et légende',
    body: 'Clique l’échelle pour régler les distances et la vitesse de marche (elles fixent les temps de vol). Dans la « Légende », clique une icône pour la changer pour tout le monde.'
  }
];

export function tourSteps(kind: Audience | 'full'): TourStep[] {
  if (kind === 'player') return PLAYER_TOUR;
  if (kind === 'admin') return ADMIN_TOUR;
  return [...PLAYER_TOUR, ...ADMIN_TOUR];
}

// --- Check-lists de démarrage -----------------------------------------
// `fact` est calculé automatiquement par la carte (voir GuideFacts) :
// l'utilisateur ne coche rien à la main.

export interface GuideFacts {
  hasPosition: boolean;
  hasMount: boolean;
  hasStatus: boolean;
  zones: number;
  places: number;
  routes: number;
  biomes: number;
  relief: number;
  scaleSet: boolean;
  mountTypes: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  why: string;
  done: (f: GuideFacts) => boolean;
  /** application à ouvrir (voir lib/apps.ts) */
  app?: string;
  actionLabel?: string;
  optional?: boolean;
}

export const PLAYER_CHECKLIST: ChecklistItem[] = [
  {
    id: 'position',
    label: 'Choisir le lieu de départ de ton personnage',
    why: 'Indispensable pour voyager. Ce choix est définitif : ensuite, chaque déplacement est un vrai trajet.',
    done: (f) => f.hasPosition,
    app: 'position',
    actionLabel: 'Choisir'
  },
  {
    id: 'status',
    label: 'Écrire un statut',
    why: 'Une phrase que les autres voient dans « Présences » (ex. « disponible pour du RP »).',
    done: (f) => f.hasStatus,
    app: 'position',
    actionLabel: 'Écrire',
    optional: true
  },
  {
    id: 'mount',
    label: 'Louer une monture',
    why: 'Elle raccourcit les trajets ; une monture volante débloque le « Vol libre ». Les locations se font sur la fiche d’un lieu qui en propose.',
    done: (f) => f.hasMount,
    app: 'mounts',
    actionLabel: 'Voir les montures',
    optional: true
  }
];

export const ADMIN_CHECKLIST: ChecklistItem[] = [
  {
    id: 'scale',
    label: 'Régler l’échelle de la carte',
    why: 'À faire en premier : elle fixe les distances et donc les temps de vol. La changer plus tard modifie tous les trajets.',
    done: (f) => f.scaleSet,
    app: 'scale',
    actionLabel: 'Régler'
  },
  {
    id: 'zones',
    label: 'Dessiner au moins une région',
    why: 'Mode édition → calque Carte → une forme (polygone, tracé libre…). Les régions donnent leur structure au monde.',
    done: (f) => f.zones > 0,
    app: 'edit',
    actionLabel: 'Ouvrir les outils'
  },
  {
    id: 'places',
    label: 'Placer au moins deux lieux',
    why: 'Outil « Lieu ». Un lieu de type « ville » possède son propre plan (quartiers, bâtiments, étages).',
    done: (f) => f.places >= 2,
    app: 'edit',
    actionLabel: 'Ouvrir les outils'
  },
  {
    id: 'routes',
    label: 'Relier les lieux par des routes',
    why: 'Sans route, un joueur à pied reste bloqué dans son lieu de départ.',
    done: (f) => f.routes > 0,
    app: 'edit',
    actionLabel: 'Ouvrir les outils'
  },
  {
    id: 'mounts',
    label: 'Créer des types de montures',
    why: 'Depuis « Montures », puis propose-les à la location sur la fiche d’un lieu.',
    done: (f) => f.mountTypes > 0,
    app: 'mounts',
    actionLabel: 'Ouvrir',
    optional: true
  },
  {
    id: 'biomes',
    label: 'Peindre biomes et relief',
    why: 'Décor, mais aussi règle de jeu : une monture peut être interdite dans certains biomes.',
    done: (f) => f.biomes + f.relief > 0,
    app: 'edit',
    actionLabel: 'Ouvrir les outils',
    optional: true
  }
];

// --- Fiches d'aide ----------------------------------------------------

export interface HelpTopic {
  id: string;
  audience: Audience;
  emoji: string;
  title: string;
  steps: string[];
  note?: string;
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'move',
    audience: 'player',
    emoji: '📍',
    title: 'Placer mon personnage et voyager',
    steps: [
      'Ouvre Applications → « Ma position » et choisis ton lieu de départ (une seule fois).',
      'Rouvre « Ma position » : les routes qui partent de ton lieu sont listées avec leur durée. Clique une destination pour partir.',
      'Le voyage se déroule en temps réel et se termine tout seul, même si tu fermes la page.'
    ],
    note: 'Aucune route listée ? Aucune ne part de ce lieu : demande à un admin d’en tracer une, ou utilise une monture volante.'
  },
  {
    id: 'mounts',
    audience: 'player',
    emoji: '🐎',
    title: 'Montures et vol libre',
    steps: [
      'Clique un lieu : s’il loue des montures, elles apparaissent sur sa fiche. Tu dois être sur place pour louer.',
      'Une monture divise la durée des trajets sur route.',
      'Avec une monture volante, Applications → « Vol libre », puis clique la destination : la distance, la durée et les éventuels biomes interdits sont vérifiés avant le départ.'
    ],
    note: 'Une location a une durée : le temps restant est affiché dans « Ma position ».'
  },
  {
    id: 'itinerary',
    audience: 'player',
    emoji: '🧭',
    title: 'Préparer un itinéraire',
    steps: [
      'Applications → « Itinéraire », choisis un départ et une arrivée.',
      'Le plus court enchaînement de routes s’allume en vert sur la carte, avec la durée totale.'
    ],
    note: '« Aucun itinéraire » signifie que les deux lieux ne sont reliés par aucune suite de routes.'
  },
  {
    id: 'quests',
    audience: 'player',
    emoji: '📜',
    title: 'Quêtes sur la carte',
    steps: [
      'Les quêtes en cours sont épinglées sur leur lieu ; clique l’épingle pour le détail.',
      'Si tu participes à une quête, rester une heure sur son lieu la valide automatiquement : un compte à rebours s’affiche en bas de la carte.'
    ]
  },
  {
    id: 'visibility',
    audience: 'player',
    emoji: '👥',
    title: 'Présences et partage de lieu',
    steps: [
      '« Présences » montre les personnages visibles, en direct.',
      'Ton statut libre se règle dans « Ma position ».',
      'Un lien de la forme /carte?lieu=… ouvre directement un lieu : copie l’adresse après avoir cliqué un lieu pour le partager.'
    ]
  },
  {
    id: 'a-build',
    audience: 'admin',
    emoji: '🗺️',
    title: 'Construire la carte, dans l’ordre',
    steps: [
      'Règle l’échelle (clic sur la barre d’échelle en bas à gauche).',
      'Mode édition → calque Carte → dessine les régions avec une forme.',
      'Place les lieux (outil « Lieu ») : clic simple pour une taille standard, clic-glisse pour choisir la taille.',
      'Relie-les avec l’outil « Route » : lieu de départ, points intermédiaires, lieu d’arrivée.',
      'Passe sur les calques Relief et Biomes pour l’habillage.'
    ]
  },
  {
    id: 'a-shapes',
    audience: 'admin',
    emoji: '⬡',
    title: 'Les outils de dessin',
    steps: [
      'Polygone : un clic par sommet ; reclique le premier point (il grossit) ou « Terminer » pour fermer.',
      'Cercle, ellipse, carré, rectangle, trapèze : clic-glisse.',
      'Tracé libre : dessine à main levée, le tracé est simplifié automatiquement.',
      '« Annuler » abandonne le tracé en cours sans rien enregistrer.'
    ],
    note: 'Sur téléphone, poser un deuxième doigt annule le tracé et repasse en navigation.'
  },
  {
    id: 'a-cities',
    audience: 'admin',
    emoji: '🏙️',
    title: 'Villes, bâtiments et étages',
    steps: [
      'Un lieu de type « ville » affiche « Entrer dans la ville » : son plan s’édite comme la carte (quartiers = formes, bâtiments = points).',
      'Un bâtiment s’ouvre pour éditer ses étages et ses pièces, avec une vue 3D.',
      'Hors ville, coche « Ce lieu est un bâtiment éditable » sur la fiche d’un lieu pour lui donner un intérieur.'
    ]
  },
  {
    id: 'a-rules',
    audience: 'admin',
    emoji: '⚖️',
    title: 'Règles de jeu réglables',
    steps: [
      'Montures : vitesse, capacité de vol, portée et biomes autorisés se règlent dans « Montures ».',
      'Marché noir et location de montures s’activent lieu par lieu, sur la fiche du lieu.',
      'Territoires : choisis le groupe qui contrôle une région ou un lieu sur sa fiche ; un drapeau apparaît sur la carte.',
      'Cristaux de téléportation : distribués depuis « Cristaux ».'
    ]
  },
  {
    id: 'a-access',
    audience: 'admin',
    emoji: '🔑',
    title: 'Donner les droits d’édition',
    steps: [
      'L’édition est ouverte aux fondateurs et aux rôles ayant la permission « manage_map ».',
      'Cette permission se donne à un rôle dans la table « role_permissions » de Supabase (détails dans le README).'
    ],
    note: 'Un membre sans ce droit ne voit ni la barre d’outils ni la catégorie Administration.'
  }
];

// --- Persistance locale -----------------------------------------------

export interface GuideState {
  seenPlayer: boolean;
  seenAdmin: boolean;
  dismissed: string[]; // suggestions masquées
}

const KEY = 'sid-guide-v1';
const EMPTY: GuideState = { seenPlayer: false, seenAdmin: false, dismissed: [] };

export function readGuideState(): GuideState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const v = JSON.parse(raw);
    return {
      seenPlayer: !!v.seenPlayer,
      seenAdmin: !!v.seenAdmin,
      dismissed: Array.isArray(v.dismissed) ? v.dismissed : []
    };
  } catch {
    return { ...EMPTY };
  }
}

export function writeGuideState(s: GuideState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // stockage indisponible (navigation privée) : la visite sera simplement reproposée
  }
}
