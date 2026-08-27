-- =====================================================================
-- 0102_icon_config.sql
-- Additif : rend les icônes de la légende éditables par les admins, et
-- permet d'ajouter de nouveaux types de bâtiments (avec leur icône)
-- pour les villes. Rien d'existant n'est supprimé.
-- =====================================================================

create table if not exists map_icon_config (
  category text not null check (category in ('place', 'building')),
  key text not null,
  label text not null,
  icon text not null,
  sort_order integer not null default 0,
  is_custom boolean not null default false,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (category, key)
);

alter table map_icon_config enable row level security;

create policy "map_icon_config_select" on map_icon_config for select
  to authenticated using (true);

create policy "map_icon_config_write" on map_icon_config for all
  to authenticated
  using (has_permission(auth.uid(), 'manage_map'))
  with check (has_permission(auth.uid(), 'manage_map'));

-- Valeurs par défaut (mêmes icônes/labels que la version précédente du
-- site). Les admins peuvent ensuite changer l'icône de chaque type
-- depuis la légende, ou ajouter de nouveaux types de bâtiments.
insert into map_icon_config (category, key, label, icon, sort_order, is_custom) values
  ('place', 'ville',     'Ville',      '🏰', 1, false),
  ('place', 'merveille', 'Merveille',  '✨', 2, false),
  ('place', 'foret',     'Forêt',      '🌲', 3, false),
  ('place', 'desert',    'Désert',     '🏜️', 4, false),
  ('place', 'montagne',  'Montagne',   '⛰️', 5, false),
  ('place', 'ruine',     'Ruine',      '🏛️', 6, false),
  ('place', 'village',   'Village',    '🏘️', 7, false),
  ('place', 'autre',     'Autre',      '📍', 8, false),
  ('building', 'maison',     'Maison',     '🏠', 1, false),
  ('building', 'cathedrale', 'Cathédrale', '⛪', 2, false),
  ('building', 'auberge',    'Auberge',    '🍺', 3, false),
  ('building', 'commerce',   'Commerce',   '🏪', 4, false),
  ('building', 'autre',      'Autre',      '🏗️', 5, false)
on conflict (category, key) do nothing;

-- Les bâtiments peuvent désormais avoir un type personnalisé
-- (n'importe quelle clé présente dans map_icon_config), plus limité
-- à la liste fixe d'origine.
alter table city_buildings drop constraint if exists city_buildings_type_check;
