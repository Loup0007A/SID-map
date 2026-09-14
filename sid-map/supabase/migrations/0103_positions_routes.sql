-- =====================================================================
-- 0103_positions_routes.sql
-- Additif : système de routes entre lieux (carte du monde) et système
-- de position des personnages ("où suis-je", visible par les autres,
-- avec Supabase Realtime). Rien d'existant n'est supprimé ni modifié.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Routes entre lieux (carte du monde)
-- ---------------------------------------------------------------------
create table if not exists map_routes (
  id uuid primary key default gen_random_uuid(),
  name text,
  from_place_id uuid references map_places(id) on delete cascade,
  to_place_id uuid references map_places(id) on delete cascade,
  path_points jsonb not null default '[]'::jsonb, -- [{x,y}, ...] en % de la carte, du départ à l'arrivée
  color text not null default '#e7c34a',
  travel_minutes integer,
  is_published boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_map_routes_from on map_routes(from_place_id);
create index if not exists idx_map_routes_to on map_routes(to_place_id);

alter table map_routes enable row level security;

create policy "map_routes_select" on map_routes for select
  to authenticated using (true);

create policy "map_routes_write" on map_routes for all
  to authenticated
  using (has_permission(auth.uid(), 'manage_map'))
  with check (has_permission(auth.uid(), 'manage_map'));

-- ---------------------------------------------------------------------
-- 2. Position du personnage de chaque membre
-- Une ligne par membre : soit à un lieu (+ éventuellement un bâtiment
-- précis dans une ville), soit en train de voyager sur une route (avec
-- un pourcentage d'avancement), soit une note libre. Le membre choisit
-- s'il est visible des autres.
-- ---------------------------------------------------------------------
create table if not exists character_positions (
  user_id uuid primary key references profiles(id) on delete cascade,
  place_id uuid references map_places(id) on delete set null,
  building_id uuid references city_buildings(id) on delete set null,
  route_id uuid references map_routes(id) on delete set null,
  route_progress numeric check (route_progress is null or route_progress between 0 and 1),
  note text,
  is_visible boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table character_positions enable row level security;

-- On voit les positions visibles de tout le monde, + toujours la sienne
-- (même masquée, pour que le membre voie son propre statut).
create policy "character_positions_select" on character_positions for select
  to authenticated using (is_visible = true or user_id = auth.uid());

-- Chacun ne gère que sa propre position.
create policy "character_positions_upsert_own" on character_positions for insert
  to authenticated with check (user_id = auth.uid());

create policy "character_positions_update_own" on character_positions for update
  to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "character_positions_delete_own" on character_positions for delete
  to authenticated using (user_id = auth.uid());

-- Un admin carte peut réinitialiser la position d'un membre en cas de
-- besoin (griefing, personnage bloqué, etc.).
create policy "character_positions_admin_write" on character_positions for all
  to authenticated
  using (has_permission(auth.uid(), 'manage_map'))
  with check (has_permission(auth.uid(), 'manage_map'));

create or replace function map_set_updated_at_position()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_character_positions_updated_at on character_positions;
create trigger trg_character_positions_updated_at before update on character_positions
  for each row execute function map_set_updated_at_position();

-- Active le Realtime sur ces deux tables pour un affichage live des
-- positions et des routes (Supabase Realtime écoute postgres_changes).
alter publication supabase_realtime add table character_positions;
alter publication supabase_realtime add table map_routes;

-- ---------------------------------------------------------------------
-- 3. RPC : liste des positions actives avec le nom du membre (nickname)
-- ---------------------------------------------------------------------
create or replace function list_active_positions()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select cp.user_id, cp.place_id, cp.building_id, cp.route_id, cp.route_progress,
           cp.note, cp.is_visible, cp.updated_at,
           pr.nickname, pr.avatar_url, pr.member_rank
    from character_positions cp
    join profiles pr on pr.id = cp.user_id
    where cp.is_visible = true or cp.user_id = auth.uid()
    order by cp.updated_at desc
  ) t;
$$;
