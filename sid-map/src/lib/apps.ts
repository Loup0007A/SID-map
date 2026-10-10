// =====================================================================
// Registre des applications. Pour ajouter une icône : dépose
// public/apps/<id>.png (carré, idéalement 256×256, fond transparent).
// Sans fichier, l'emoji est utilisé à la place.
// Pour ajouter une application : ajoute une entrée dans APPS puis gère
// son `id` dans runApp() de WorldMap.tsx.
// =====================================================================

export type AppCategory = 'voyage' | 'personnage' | 'economie' | 'carte' | 'admin';

export interface AppCategoryDef {
  id: AppCategory;
  label: string;
  emoji: string;
  adminOnly?: boolean;
}

export const CATEGORIES: AppCategoryDef[] = [
  { id: 'voyage', label: 'Voyage', emoji: '🧭' },
  { id: 'personnage', label: 'Personnage', emoji: '🧙' },
  { id: 'economie', label: 'Économie', emoji: '💰' },
  { id: 'carte', label: 'Carte', emoji: '🗺️' },
  { id: 'admin', label: 'Administration', emoji: '🛠', adminOnly: true }
];

export interface AppDef {
  id: string;
  name: string;
  description: string;
  category: AppCategory;
  emoji: string;
  adminOnly?: boolean;
}

export const APPS: AppDef[] = [
  { id: 'position', name: 'Ma position', description: 'Où tu es, ton statut, partir en voyage.', category: 'voyage', emoji: '📍' },
  { id: 'flight', name: 'Vol libre', description: 'Voler vers un lieu en ligne droite avec une monture volante.', category: 'voyage', emoji: '🕊️' },
  { id: 'itinerary', name: 'Itinéraire', description: 'Calculer un trajet entre deux lieux.', category: 'voyage', emoji: '🧭' },
  { id: 'mounts', name: 'Montures', description: 'Ta monture, ses stats et le catalogue.', category: 'personnage', emoji: '🐎' },
  { id: 'crystals', name: 'Cristaux', description: 'Cristaux de téléportation reçus.', category: 'personnage', emoji: '💎' },
  { id: 'blackmarket', name: 'Marchés noirs', description: 'Lieux où des étals clandestins sont autorisés.', category: 'economie', emoji: '🕶️' },
  { id: 'layers', name: 'Calques', description: 'Afficher ou masquer relief, biomes et textures.', category: 'carte', emoji: '🗂️' },
  { id: 'export', name: 'Exporter la carte', description: 'Télécharger la carte en image PNG.', category: 'carte', emoji: '🖼️' },
  { id: 'help', name: 'Aide', description: 'Check-list de démarrage, fiches « comment faire » et visite guidée.', category: 'carte', emoji: '❓' },
  { id: 'edit', name: 'Outils d’édition', description: 'Dessiner zones, lieux, routes, relief, biomes.', category: 'admin', emoji: '🛠', adminOnly: true },
  { id: 'scale', name: 'Échelle', description: 'Régler l’échelle de la carte et la vitesse de marche.', category: 'admin', emoji: '📏', adminOnly: true }
];

export function iconPath(id: string) {
  return `/apps/${id}.png`;
}

// --- Bus d'évènements très léger : le lanceur (barre du haut) envoie, la carte exécute.
export const APP_EVENT = 'sid-open-app';

export function openApp(id: string) {
  window.dispatchEvent(new CustomEvent(APP_EVENT, { detail: id }));
}
