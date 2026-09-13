-- =====================================================================
-- 0100_rp_map_schema.sql
-- Ajoute le système de carte du monde RP (SID) sur le projet Supabase
-- existant. 100% additif : aucune table/colonne existante n'est
-- touchée ou supprimée.
--
-- Renomme ce fichier avec le vrai prochain numéro de migration du
-- premier site avant de le jouer (ex: 0042_rp_map_schema.sql) pour
-- garder l'historique cohérent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Nouvelle permission "manage_map"
-- La contrainte CHECK sur role_permissions.permission est élargie
-- (ajout uniquement, aucune valeur existante retirée).
-- ---------------------------------------------------------------------
alter table role_permissions
  drop constraint if exists role_permissions_permission_check;

alter table role_permissions
  add constraint role_permissions_permission_check
  check (permission in (
    'manage_roles','manage_org_chart','manage_quests','manage_shop',
    'manage_teams','manage_economy','recruit','manage_users',
    'manage_map'
  ));

-- ---------------------------------------------------------------------
-- 1. Zones de la carte du monde (continents, îles, mers, océans)
-- ---------------------------------------------------------------------
create table if not exists map_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('continent','ile','mer','ocean')),
  color text not null default '#60a5fa',
  path_points jsonb not null default '[]'::jsonb, -- [{x,y}, ...] polygone en % de la carte (0-100)
  description text,
  image_url text,
  z_index integer not null default 0,
  is_published boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Lieux posés sur la carte (villes, merveilles, forêts, déserts...)
-- ---------------------------------------------------------------------
create table if not exists map_places (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid references map_zones(id) on delete set null,
  name text not null,
  type text not null check (type in ('ville','merveille','foret','desert','montagne','ruine','village','autre')),
  x numeric not null, -- position en % de la carte (0-100)
  y numeric not null,
  icon text,
  description text,
  image_url text,
  is_published boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_map_places_zone on map_places(zone_id);

-- ---------------------------------------------------------------------
-- 3. Commentaires (polymorphe : zone / lieu / bâtiment)
-- ---------------------------------------------------------------------
create table if not exists map_comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('zone','place','building')),
  target_id uuid not null,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists idx_map_comments_target on map_comments(target_type, target_id);

-- ---------------------------------------------------------------------
-- 4. Quartiers d'une ville
-- ---------------------------------------------------------------------
create table if not exists city_districts (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references map_places(id) on delete cascade,
  name text not null,
  color text not null default '#a3a3a3',
  path_points jsonb not null default '[]'::jsonb, -- polygone en % du plan de ville
  description text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_city_districts_city on city_districts(city_id);

-- ---------------------------------------------------------------------
-- 5. Bâtiments d'une ville (maisons, cathédrales, auberges, commerces)
-- ---------------------------------------------------------------------
create table if not exists city_buildings (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references map_places(id) on delete cascade,
  district_id uuid references city_districts(id) on delete set null,
  type text not null check (type in ('maison','cathedrale','auberge','commerce','autre')),
  name text,
  x numeric not null, -- position en % du plan de ville
  y numeric not null,
  width numeric not null default 4,
  height numeric not null default 4,
  rotation numeric not null default 0,
  description text,
  image_url text,
  owner_id uuid references profiles(id) on delete set null, -- appartenance (membre)
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_city_buildings_city on city_buildings(city_id);
create index if not exists idx_city_buildings_owner on city_buildings(owner_id);

-- ---------------------------------------------------------------------
-- 6. Étages d'un bâtiment (maison à plusieurs étages, cathédrale, ...)
-- ---------------------------------------------------------------------
create table if not exists building_floors (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references city_buildings(id) on delete cascade,
  floor_number integer not null, -- 0 = rez-de-chaussée, négatif = sous-sol
  name text,
  plan_data jsonb not null default '[]'::jsonb, -- [{id,name,type,x,y,w,h}] pièces
  description text,
  image_url text,
  created_at timestamptz not null default now(),
  unique(building_id, floor_number)
);

create index if not exists idx_building_floors_building on building_floors(building_id);

-- ---------------------------------------------------------------------
-- 7. updated_at automatique
-- ---------------------------------------------------------------------
create or replace function map_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_map_zones_updated_at on map_zones;
create trigger trg_map_zones_updated_at before update on map_zones
  for each row execute function map_set_updated_at();

drop trigger if exists trg_map_places_updated_at on map_places;
create trigger trg_map_places_updated_at before update on map_places
  for each row execute function map_set_updated_at();

drop trigger if exists trg_city_buildings_updated_at on city_buildings;
create trigger trg_city_buildings_updated_at before update on city_buildings
  for each row execute function map_set_updated_at();

-- ---------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------
alter table map_zones enable row level security;
alter table map_places enable row level security;
alter table map_comments enable row level security;
alter table city_districts enable row level security;
alter table city_buildings enable row level security;
alter table building_floors enable row level security;

-- Lecture : tout membre authentifié (statut vérifié côté appli/RPC)
create policy "map_zones_select" on map_zones for select
  to authenticated using (true);
create policy "map_places_select" on map_places for select
  to authenticated using (true);
create policy "map_comments_select" on map_comments for select
  to authenticated using (true);
create policy "city_districts_select" on city_districts for select
  to authenticated using (true);
create policy "city_buildings_select" on city_buildings for select
  to authenticated using (true);
create policy "building_floors_select" on building_floors for select
  to authenticated using (true);

-- Écriture carte du monde : manage_map ou fondateur
create policy "map_zones_write" on map_zones for all
  to authenticated
  using (has_permission(auth.uid(), 'manage_map'))
  with check (has_permission(auth.uid(), 'manage_map'));

create policy "map_places_write" on map_places for all
  to authenticated
  using (has_permission(auth.uid(), 'manage_map'))
  with check (has_permission(auth.uid(), 'manage_map'));

create policy "city_districts_write" on city_districts for all
  to authenticated
  using (has_permission(auth.uid(), 'manage_map'))
  with check (has_permission(auth.uid(), 'manage_map'));

-- Bâtiments : l'admin carte peut tout faire, le propriétaire peut
-- modifier la fiche de son propre bâtiment (description/image)
create policy "city_buildings_write_admin" on city_buildings for all
  to authenticated
  using (has_permission(auth.uid(), 'manage_map'))
  with check (has_permission(auth.uid(), 'manage_map'));

create policy "city_buildings_update_owner" on city_buildings for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "building_floors_write_admin" on building_floors for all
  to authenticated
  using (has_permission(auth.uid(), 'manage_map'))
  with check (has_permission(auth.uid(), 'manage_map'));

create policy "building_floors_write_owner" on building_floors for all
  to authenticated
  using (
    exists (
      select 1 from city_buildings b
      where b.id = building_floors.building_id and b.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from city_buildings b
      where b.id = building_floors.building_id and b.owner_id = auth.uid()
    )
  );

-- Commentaires : chacun poste/supprime les siens, l'admin carte modère
create policy "map_comments_insert" on map_comments for insert
  to authenticated with check (user_id = auth.uid());

create policy "map_comments_delete_own" on map_comments for delete
  to authenticated using (user_id = auth.uid());

create policy "map_comments_delete_admin" on map_comments for delete
  to authenticated using (has_permission(auth.uid(), 'manage_map'));

-- ---------------------------------------------------------------------
-- 9. RPC pratiques
-- ---------------------------------------------------------------------

-- Carte du monde complète (zones + lieux) en un seul appel
create or replace function get_world_map()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'zones', coalesce((select jsonb_agg(z order by z.z_index) from map_zones z where z.is_published or has_permission(auth.uid(),'manage_map')), '[]'::jsonb),
    'places', coalesce((select jsonb_agg(p) from map_places p where p.is_published or has_permission(auth.uid(),'manage_map')), '[]'::jsonb)
  );
$$;

-- Plan complet d'une ville (quartiers + bâtiments)
create or replace function get_city_plan(p_city_id uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'city', (select to_jsonb(pl) from map_places pl where pl.id = p_city_id),
    'districts', coalesce((select jsonb_agg(d) from city_districts d where d.city_id = p_city_id), '[]'::jsonb),
    'buildings', coalesce((select jsonb_agg(b) from city_buildings b where b.city_id = p_city_id), '[]'::jsonb)
  );
$$;

-- Détail d'un bâtiment + tous ses étages
create or replace function get_building_detail(p_building_id uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'building', (select to_jsonb(b) from city_buildings b where b.id = p_building_id),
    'floors', coalesce((select jsonb_agg(f order by f.floor_number) from building_floors f where f.building_id = p_building_id), '[]'::jsonb)
  );
$$;

-- Commentaires d'une cible avec le profil auteur (pseudo, avatar)
create or replace function list_map_comments(p_target_type text, p_target_id uuid)
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.created_at), '[]'::jsonb)
  from (
    select c.id, c.content, c.created_at, c.user_id,
           pr.avatar_url, pr.member_rank
    from map_comments c
    join profiles pr on pr.id = c.user_id
    where c.target_type = p_target_type and c.target_id = p_target_id
  ) t;
$$;

-- ---------------------------------------------------------------------
-- 10. Storage : bucket public pour les images de la carte
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('map-images', 'map-images', true)
on conflict (id) do nothing;

create policy "map_images_public_read" on storage.objects for select
  using (bucket_id = 'map-images');

create policy "map_images_admin_write" on storage.objects for insert
  to authenticated with check (
    bucket_id = 'map-images' and has_permission(auth.uid(), 'manage_map')
  );

create policy "map_images_admin_update" on storage.objects for update
  to authenticated using (
    bucket_id = 'map-images' and has_permission(auth.uid(), 'manage_map')
  );

create policy "map_images_admin_delete" on storage.objects for delete
  to authenticated using (
    bucket_id = 'map-images' and has_permission(auth.uid(), 'manage_map')
  );
