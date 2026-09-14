-- =====================================================================
-- 0101_marker_shapes.sql
-- Additif : permet aux lieux (carte du monde) et bâtiments (plan de
-- ville) d'être des ronds (taille = rayon) ou des rectangles simples,
-- au lieu d'une taille fixe. Rien d'existant n'est supprimé ; les
-- valeurs par défaut préservent le rendu actuel des lignes déjà en
-- base.
-- =====================================================================

alter table map_places
  add column if not exists shape text not null default 'circle' check (shape in ('circle','rect'));
alter table map_places
  add column if not exists radius numeric not null default 3;
alter table map_places
  add column if not exists width numeric;
alter table map_places
  add column if not exists height numeric;

alter table city_buildings
  add column if not exists shape text not null default 'rect' check (shape in ('circle','rect'));

-- Les RPC get_world_map / get_city_plan sérialisent déjà la ligne
-- entière (jsonb_agg sur la table), donc elles exposent automatiquement
-- ces nouvelles colonnes sans modification.
