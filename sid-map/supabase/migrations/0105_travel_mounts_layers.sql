-- =====================================================================
-- 0105_travel_mounts_layers.sql
-- Additif et sécurisant : remplace le déplacement instantané par un
-- vrai système de voyage chronométré (à pied via les routes, ou en vol
-- avec une monture), dissocie le statut du lieu, ajoute des couches
-- "relief" et "biomes", permet à un lieu d'être lui-même un bâtiment
-- éditable (sous-sols, escaliers), un système de montures louables
-- (revenu 50/50 pour l'admin propriétaire), et la validation
-- automatique de quête par présence prolongée.
--
-- IMPORTANT — fermeture de la faille de téléportation :
-- Les policies RLS qui permettaient à un membre de modifier sa propre
-- ligne character_positions EN ÉCRITURE LIBRE sont supprimées. Tous
-- les changements de lieu passent désormais par les fonctions
-- SECURITY DEFINER ci-dessous, qui valident le trajet côté serveur
-- (pas seulement côté interface). Le statut libre reste toujours
-- modifiable indépendamment, via set_character_status().
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. character_positions : nouvelles colonnes (voyage réel, statut
-- dissocié, monture active)
-- ---------------------------------------------------------------------
alter table character_positions add column if not exists status text;
alter table character_positions add column if not exists arrived_at timestamptz;
alter table character_positions add column if not exists travel_started_at timestamptz;
alter table character_positions add column if not exists travel_duration_minutes numeric;
alter table character_positions add column if not exists flight_target_place_id uuid references map_places(id) on delete set null;
alter table character_positions add column if not exists active_mount_id uuid;

-- Ferme la faille : plus d'écriture libre de sa propre ligne. Seules
-- les fonctions SECURITY DEFINER ci-dessous peuvent modifier lieu,
-- route ou monture. La lecture (select) et l'écriture admin restent
-- inchangées.
drop policy if exists "character_positions_upsert_own" on character_positions;
drop policy if exists "character_positions_update_own" on character_positions;
drop policy if exists "character_positions_delete_own" on character_positions;

-- ---------------------------------------------------------------------
-- 1. Montures louables
-- ---------------------------------------------------------------------
create table if not exists mount_types (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text not null default '🐴',
  speed_multiplier numeric not null default 2 check (speed_multiplier > 0),
  can_fly boolean not null default false,
  rental_price numeric not null default 50 check (rental_price >= 0),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists mount_rentals (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references map_places(id) on delete cascade,
  mount_type_id uuid not null references mount_types(id) on delete cascade,
  price_override numeric,
  stock integer, -- null = illimité
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table character_positions
  add constraint character_positions_active_mount_fkey
  foreign key (active_mount_id) references mount_types(id) on delete set null;

alter table mount_types enable row level security;
alter table mount_rentals enable row level security;

create policy "mount_types_select" on mount_types for select to authenticated using (true);
create policy "mount_types_write" on mount_types for all to authenticated
  using (has_permission(auth.uid(), 'manage_map')) with check (has_permission(auth.uid(), 'manage_map'));

create policy "mount_rentals_select" on mount_rentals for select to authenticated using (true);
create policy "mount_rentals_write" on mount_rentals for all to authenticated
  using (has_permission(auth.uid(), 'manage_map')) with check (has_permission(auth.uid(), 'manage_map'));

-- ---------------------------------------------------------------------
-- 2. Relief et biomes (nouvelles couches de la carte du monde)
-- ---------------------------------------------------------------------
create table if not exists map_relief (
  id uuid primary key default gen_random_uuid(),
  path_points jsonb not null default '[]'::jsonb,
  elevation numeric not null default 0, -- positif = altitude, négatif = dépression
  is_published boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists map_biomes (
  id uuid primary key default gen_random_uuid(),
  path_points jsonb not null default '[]'::jsonb,
  biome_type text not null default 'plaine',
  color text not null default '#7ba05b',
  is_published boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table map_relief enable row level security;
alter table map_biomes enable row level security;

create policy "map_relief_select" on map_relief for select to authenticated using (true);
create policy "map_relief_write" on map_relief for all to authenticated
  using (has_permission(auth.uid(), 'manage_map')) with check (has_permission(auth.uid(), 'manage_map'));

create policy "map_biomes_select" on map_biomes for select to authenticated using (true);
create policy "map_biomes_write" on map_biomes for all to authenticated
  using (has_permission(auth.uid(), 'manage_map')) with check (has_permission(auth.uid(), 'manage_map'));

-- ---------------------------------------------------------------------
-- 3. Un lieu de la carte principale peut être lui-même un bâtiment
-- éditable (étages, sous-sols via floor_number négatif, escaliers).
-- ---------------------------------------------------------------------
alter table map_places add column if not exists is_building boolean not null default false;

alter table building_floors alter column building_id drop not null;
alter table building_floors add column if not exists place_id uuid references map_places(id) on delete cascade;

alter table building_floors drop constraint if exists building_floors_building_id_floor_number_key;
do $$ begin
  alter table building_floors add constraint building_floors_owner_check check (
    (building_id is not null and place_id is null) or (building_id is null and place_id is not null)
  );
exception when duplicate_object then null;
end $$;

create unique index if not exists idx_building_floors_building_floor
  on building_floors(building_id, floor_number) where building_id is not null;
create unique index if not exists idx_building_floors_place_floor
  on building_floors(place_id, floor_number) where place_id is not null;

-- ---------------------------------------------------------------------
-- 4. RPC : voyage réel (aucune téléportation possible)
-- ---------------------------------------------------------------------

-- Premier positionnement uniquement (aucun lieu actuel). Une fois posé,
-- tout changement de lieu passe par start_journey + arrive_at_destination.
create or replace function set_initial_place(p_place_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_existing record;
begin
  select * into v_existing from character_positions where user_id = auth.uid();
  if found and v_existing.place_id is not null then
    return jsonb_build_object('error', 'already_placed');
  end if;

  insert into character_positions (user_id, place_id, is_visible, arrived_at)
  values (auth.uid(), p_place_id, true, now())
  on conflict (user_id) do update set
    place_id = excluded.place_id,
    arrived_at = now()
  where character_positions.place_id is null;

  return jsonb_build_object('success', true);
end;
$$;

-- Démarre un trajet : soit p_route_id (à pied/monture sur une route
-- existante, doit partir du lieu actuel), soit p_target_place_id (vol
-- direct, nécessite une monture volante active). Le serveur calcule
-- lui-même la durée réelle : impossible de l'inventer côté client.
create or replace function start_journey(p_route_id uuid, p_target_place_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_pos record;
  v_mount record;
  v_route record;
  v_dest uuid;
  v_duration numeric;
  v_from record;
  v_to record;
  v_dist numeric;
begin
  select * into v_pos from character_positions where user_id = auth.uid();
  if not found or v_pos.place_id is null then
    return jsonb_build_object('error', 'no_current_place');
  end if;
  if v_pos.travel_started_at is not null then
    return jsonb_build_object('error', 'already_traveling');
  end if;

  if v_pos.active_mount_id is not null then
    select * into v_mount from mount_types where id = v_pos.active_mount_id;
  end if;

  if p_route_id is not null then
    select * into v_route from map_routes where id = p_route_id;
    if not found then
      return jsonb_build_object('error', 'route_not_found');
    end if;
    if v_route.from_place_id = v_pos.place_id then
      v_dest := v_route.to_place_id;
    elsif v_route.to_place_id = v_pos.place_id then
      v_dest := v_route.from_place_id;
    else
      return jsonb_build_object('error', 'route_not_connected');
    end if;

    v_duration := coalesce(v_route.travel_minutes, 30) / coalesce(v_mount.speed_multiplier, 1);

    update character_positions set
      route_id = p_route_id,
      route_progress = 0,
      flight_target_place_id = null,
      travel_started_at = now(),
      travel_duration_minutes = v_duration,
      building_id = null
    where user_id = auth.uid();

    return jsonb_build_object('success', true, 'destination', v_dest, 'duration_minutes', v_duration);

  elsif p_target_place_id is not null then
    if v_mount.can_fly is not true then
      return jsonb_build_object('error', 'no_flying_mount');
    end if;

    select x, y into v_from from map_places where id = v_pos.place_id;
    select x, y into v_to from map_places where id = p_target_place_id;
    if v_from is null or v_to is null then
      return jsonb_build_object('error', 'place_not_found');
    end if;

    v_dist := sqrt(power(v_to.x - v_from.x, 2) + power(v_to.y - v_from.y, 2));
    v_duration := greatest(2, round(v_dist * 3 / v_mount.speed_multiplier));

    update character_positions set
      route_id = null,
      route_progress = 0,
      flight_target_place_id = p_target_place_id,
      travel_started_at = now(),
      travel_duration_minutes = v_duration,
      building_id = null
    where user_id = auth.uid();

    return jsonb_build_object('success', true, 'destination', p_target_place_id, 'duration_minutes', v_duration);
  else
    return jsonb_build_object('error', 'missing_target');
  end if;
end;
$$;

-- À appeler quand le chrono côté client atteint zéro. Revalide le
-- temps écoulé côté serveur (le client ne peut pas tricher en
-- rappelant la fonction trop tôt).
create or replace function arrive_at_destination()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_pos record;
  v_dest uuid;
  v_elapsed_min numeric;
begin
  select * into v_pos from character_positions where user_id = auth.uid();
  if not found or v_pos.travel_started_at is null then
    return jsonb_build_object('error', 'not_traveling');
  end if;

  v_elapsed_min := extract(epoch from (now() - v_pos.travel_started_at)) / 60;
  if v_elapsed_min < v_pos.travel_duration_minutes then
    return jsonb_build_object(
      'error', 'not_yet',
      'remaining_minutes', ceil(v_pos.travel_duration_minutes - v_elapsed_min)
    );
  end if;

  if v_pos.route_id is not null then
    select case when from_place_id = v_pos.place_id then to_place_id else from_place_id end
      into v_dest from map_routes where id = v_pos.route_id;
  else
    v_dest := v_pos.flight_target_place_id;
  end if;

  if v_dest is null then
    return jsonb_build_object('error', 'destination_unknown');
  end if;

  update character_positions set
    place_id = v_dest,
    route_id = null,
    route_progress = null,
    flight_target_place_id = null,
    travel_started_at = null,
    travel_duration_minutes = null,
    arrived_at = now()
  where user_id = auth.uid();

  return jsonb_build_object('success', true, 'place_id', v_dest);
end;
$$;

-- Statut libre ("dort", "disponible RP"...), totalement indépendant du
-- lieu — modifiable à tout moment, y compris en voyage.
create or replace function set_character_status(p_status text, p_visible boolean default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  insert into character_positions (user_id, status, is_visible)
  values (auth.uid(), nullif(p_status, ''), coalesce(p_visible, true))
  on conflict (user_id) do update set
    status = nullif(p_status, ''),
    is_visible = coalesce(p_visible, character_positions.is_visible);
  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. RPC : location d'une monture (revenu 50/50 pour l'admin qui a
-- créé le point de location — l'autre moitié est retirée de la
-- circulation, comme une taxe, pour ne pas gonfler l'économie).
-- Ne touche jamais que la colonne balance de wallets, en UPDATE
-- uniquement (jamais d'INSERT), donc sans risque sur ses autres
-- colonnes éventuelles.
-- ---------------------------------------------------------------------
create or replace function rent_mount(p_rental_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_price numeric;
  v_owner uuid;
  v_mount_type_id uuid;
  v_place_id uuid;
  v_pos record;
  v_balance numeric;
  v_admin_share numeric;
begin
  select coalesce(mr.price_override, mt.rental_price), mr.created_by, mr.mount_type_id, mr.place_id
    into v_price, v_owner, v_mount_type_id, v_place_id
  from mount_rentals mr
  join mount_types mt on mt.id = mr.mount_type_id
  where mr.id = p_rental_id;

  if v_price is null then
    return jsonb_build_object('error', 'rental_not_found');
  end if;

  select * into v_pos from character_positions where user_id = auth.uid();
  if not found or v_pos.place_id is distinct from v_place_id then
    return jsonb_build_object('error', 'not_at_location');
  end if;
  if v_pos.travel_started_at is not null then
    return jsonb_build_object('error', 'currently_traveling');
  end if;

  select balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_price then
    return jsonb_build_object('error', 'insufficient_funds');
  end if;

  v_admin_share := round(v_price * 0.5, 2);

  update wallets set balance = balance - v_price where user_id = auth.uid();
  if v_owner is not null then
    update wallets set balance = balance + v_admin_share where user_id = v_owner;
  end if;

  update character_positions set active_mount_id = v_mount_type_id where user_id = auth.uid();

  return jsonb_build_object(
    'success', true, 'mount_type_id', v_mount_type_id,
    'price', v_price, 'admin_share', v_admin_share
  );
end;
$$;

-- Précise le bâtiment où l'on se trouve DANS la ville actuelle (ce
-- n'est pas un voyage : le bâtiment doit appartenir au lieu où l'on
-- est déjà physiquement).
create or replace function set_current_building(p_building_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_city_id uuid;
  v_pos record;
begin
  select * into v_pos from character_positions where user_id = auth.uid();
  if not found or v_pos.place_id is null then
    return jsonb_build_object('error', 'no_current_place');
  end if;
  if v_pos.travel_started_at is not null then
    return jsonb_build_object('error', 'currently_traveling');
  end if;

  if p_building_id is not null then
    select city_id into v_city_id from city_buildings where id = p_building_id;
    if v_city_id is distinct from v_pos.place_id then
      return jsonb_build_object('error', 'building_not_here');
    end if;
  end if;

  update character_positions set building_id = p_building_id where user_id = auth.uid();
  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. RPC : validation de quête par présence prolongée (1h). Suppose
-- que quest_participants a des colonnes quest_id/user_id (hypothèse
-- raisonnable mais non confirmée) et appelle validate_quest_participant
-- déjà existante plutôt que d'écrire directement dans une table dont
-- le schéma complet n'est pas connu ici. Si cette fonction est
-- réservée aux admins côté site principal, l'appel échouera proprement
-- (capturé) sans rien casser.
-- ---------------------------------------------------------------------
create or replace function check_quest_arrival()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_pos record;
  v_quest record;
  v_elapsed_min numeric;
  v_result jsonb := '[]'::jsonb;
begin
  select * into v_pos from character_positions where user_id = auth.uid();
  if not found or v_pos.place_id is null or v_pos.arrived_at is null then
    return v_result;
  end if;

  v_elapsed_min := extract(epoch from (now() - v_pos.arrived_at)) / 60;
  if v_elapsed_min < 60 then
    return v_result;
  end if;

  for v_quest in
    select q.id
    from quests q
    join quest_participants qp on qp.quest_id = q.id and qp.user_id = auth.uid()
    where q.place_id = v_pos.place_id
  loop
    begin
      perform validate_quest_participant(v_quest.id, auth.uid());
      v_result := v_result || jsonb_build_object('quest_id', v_quest.id, 'validated', true);
    exception when others then
      v_result := v_result || jsonb_build_object('quest_id', v_quest.id, 'validated', false, 'error', sqlerrm);
    end;
  end loop;

  return v_result;
end;
$$;
