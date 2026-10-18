-- =====================================================================
-- 0113 : UN SEUL SYSTÈME DE TRAJET pour la Cartographie et le site
-- principal (Dossier Central). À lancer une fois ; peut être relancée.
--
-- Avant, les deux sites écrivaient dans character_positions avec deux
-- logiques incompatibles :
--   - le site principal (start_travel / advance_my_travel) vidait place_id
--     pendant le trajet et ne renseignait pas la durée ;
--   - la carte (start_journey / arrive_at_destination) gardait place_id et
--     calculait la durée avec la monture.
-- Résultat : un trajet lancé d'un côté pouvait être terminé de travers par
-- l'autre (arrivée immédiate, retour au point de départ, arrêt à une étape),
-- et la carte ne savait pas lancer un itinéraire à plusieurs étapes.
--
-- Désormais, une seule règle, appliquée par le serveur :
--   - pendant un trajet, place_id = lieu de départ de l'étape en cours ;
--   - planned_path = étapes restantes (étape en cours comprise), chacune
--     avec sa durée figée au départ (monture comprise) ;
--   - travel_duration_minutes = durée de l'étape en cours ;
--   - l'étape suivante démarre à l'heure exacte où la précédente finit
--     (aucun temps perdu si personne n'a la page ouverte) ;
--   - durée d'une route : travel_minutes, sinon longueur du tracé × 2
--     (minimum 5 min) — même formule que les deux sites.
-- Les anciennes fonctions gardent leur nom et leur signature.
-- =====================================================================

alter table character_positions add column if not exists planned_path jsonb;
alter table character_positions add column if not exists spawned boolean not null default false;
alter table character_positions add column if not exists travel_duration_minutes numeric;
alter table character_positions add column if not exists flight_target_place_id uuid references map_places(id) on delete set null;
alter table character_positions add column if not exists arrived_at timestamptz;

-- Quiconque a déjà une position a un point de départ (sinon le site
-- principal lui reproposait d'en choisir un : téléportation possible).
update character_positions set spawned = true
where not spawned and (place_id is not null or route_id is not null or flight_target_place_id is not null);

-- ---------------------------------------------------------------------
-- Durée à pied d'une route (minutes).
-- ---------------------------------------------------------------------
create or replace function _route_walk_minutes(p_route_id uuid)
returns numeric
language sql stable security definer set search_path = public
as $$
  select case
    when r.travel_minutes is not null then r.travel_minutes::numeric
    else greatest(5, coalesce((
      select sum(sqrt(power((b.pt->>'x')::numeric - (a.pt->>'x')::numeric, 2)
                    + power((b.pt->>'y')::numeric - (a.pt->>'y')::numeric, 2)))
      from jsonb_array_elements(coalesce(r.path_points, '[]'::jsonb)) with ordinality as a(pt, i)
      join jsonb_array_elements(coalesce(r.path_points, '[]'::jsonb)) with ordinality as b(pt, j) on b.j = a.i + 1
    ), 0) * 2)
  end
  from map_routes r where r.id = p_route_id;
$$;

-- Trajets en cours lancés par l'ancien site principal : on retrouve le
-- lieu de départ de l'étape et la durée, pour que les deux sites les
-- voient pareil.
update character_positions cp set
  place_id = case when r.to_place_id = (cp.planned_path->0->>'to_place_id')::uuid then r.from_place_id else r.to_place_id end
from map_routes r
where cp.route_id = r.id and cp.place_id is null and cp.travel_started_at is not null;

update character_positions set travel_duration_minutes = coalesce(_route_walk_minutes(route_id), 30)
where travel_started_at is not null and route_id is not null and travel_duration_minutes is null;

-- ---------------------------------------------------------------------
-- Fait avancer le trajet d'un membre : termine les étapes écoulées,
-- enchaîne les suivantes, pose l'arrivée. Seul endroit qui le fait.
-- Renvoie { state: idle | traveling | arrived, ... }.
-- ---------------------------------------------------------------------
create or replace function _travel_tick(p_uid uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_pos record;
  v_end timestamptz;
  v_dest uuid;
  v_first jsonb;
  v_rest jsonb;
  v_next_route uuid;
  v_next_min numeric;
  v_name text;
  v_guard int := 0;
begin
  loop
    v_guard := v_guard + 1;
    if v_guard > 60 then
      return jsonb_build_object('state', 'traveling');
    end if;
    v_dest := null;

    select * into v_pos from character_positions where user_id = p_uid for update;
    if not found then
      return jsonb_build_object('state', 'idle');
    end if;
    if v_pos.travel_started_at is null then
      return jsonb_build_object('state', 'idle', 'place_id', v_pos.place_id);
    end if;

    if v_pos.travel_duration_minutes is null then
      v_pos.travel_duration_minutes := case
        when v_pos.route_id is not null then coalesce(_route_walk_minutes(v_pos.route_id), 30)
        else 30 end;
      update character_positions set travel_duration_minutes = v_pos.travel_duration_minutes where user_id = p_uid;
    end if;

    v_end := v_pos.travel_started_at + make_interval(secs => v_pos.travel_duration_minutes * 60);
    if now() < v_end then
      return jsonb_build_object(
        'state', 'traveling',
        'remaining_minutes', ceil(extract(epoch from (v_end - now())) / 60)
      );
    end if;

    -- Étape terminée : où arrive-t-on ?
    v_first := v_pos.planned_path -> 0;
    if v_pos.route_id is null then
      v_dest := v_pos.flight_target_place_id;
    else
      if v_first is not null and (v_first->>'route_id')::uuid = v_pos.route_id then
        v_dest := (v_first->>'to_place_id')::uuid;
      end if;
      if v_dest is null then
        select case
                 when from_place_id = v_pos.place_id then to_place_id
                 when to_place_id = v_pos.place_id then from_place_id
                 else to_place_id
               end
          into v_dest
          from map_routes where id = v_pos.route_id;
      end if;
    end if;
    v_dest := coalesce(v_dest, v_pos.place_id);

    v_rest := null;
    if v_pos.route_id is not null and v_first is not null
       and (v_first->>'route_id')::uuid = v_pos.route_id
       and jsonb_array_length(v_pos.planned_path) > 1 then
      v_rest := v_pos.planned_path - 0;
    end if;

    if v_rest is not null then
      v_next_route := (v_rest->0->>'route_id')::uuid;
      v_next_min := coalesce((v_rest->0->>'minutes')::numeric, _route_walk_minutes(v_next_route), 30);
      update character_positions set
        place_id = v_dest,
        building_id = null,
        route_id = v_next_route,
        route_progress = 0,
        flight_target_place_id = null,
        travel_started_at = v_end,
        travel_duration_minutes = v_next_min,
        planned_path = v_rest
      where user_id = p_uid;
      -- on reboucle : l'étape suivante est peut-être déjà finie elle aussi
    else
      update character_positions set
        place_id = v_dest,
        building_id = null,
        route_id = null,
        route_progress = null,
        flight_target_place_id = null,
        travel_started_at = null,
        travel_duration_minutes = null,
        planned_path = null,
        arrived_at = v_end
      where user_id = p_uid;

      begin
        select name into v_name from map_places where id = v_dest;
        insert into notifications (user_id, type, title, body, link)
        values (p_uid, 'travel_arrived', 'Arrivée à destination',
                'Tu es arrivé' || coalesce(' à ' || v_name, '') || '.', '/dashboard/map');
      exception when others then
        null; -- notifications absentes ou type refusé : l'arrivée compte quand même
      end;

      return jsonb_build_object('state', 'arrived', 'place_id', v_dest);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Lance un itinéraire (une ou plusieurs routes qui se suivent depuis la
-- position actuelle). Renvoie { success } ou { error, message }.
-- ---------------------------------------------------------------------
create or replace function _start_route_plan(p_uid uuid, p_path jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_pos record;
  v_mount record;
  v_speed numeric := 1;
  v_step jsonb;
  v_route record;
  v_cursor uuid;
  v_to uuid;
  v_out jsonb := '[]'::jsonb;
  v_min numeric;
  v_from_pt record;
  v_to_pt record;
  v_blocked text;
  v_biomes text[];
begin
  perform _travel_tick(p_uid);

  select * into v_pos from character_positions where user_id = p_uid for update;
  if not found or v_pos.place_id is null then
    return jsonb_build_object('error', 'no_current_place',
      'message', 'Choisis d''abord ton point de départ sur la carte.');
  end if;
  if v_pos.travel_started_at is not null then
    return jsonb_build_object('error', 'already_traveling',
      'message', 'Tu es déjà en route : attends d''être arrivé avant de repartir.');
  end if;
  if p_path is null or jsonb_typeof(p_path) <> 'array' or jsonb_array_length(p_path) = 0 then
    return jsonb_build_object('error', 'empty_path', 'message', 'Trajet vide.');
  end if;
  if jsonb_array_length(p_path) > 60 then
    return jsonb_build_object('error', 'path_too_long', 'message', 'Itinéraire trop long.');
  end if;

  if v_pos.active_mount_id is not null
     and (v_pos.mount_expires_at is null or v_pos.mount_expires_at > now()) then
    select * into v_mount from mount_types where id = v_pos.active_mount_id;
    if found then
      v_speed := greatest(coalesce(v_mount.speed_multiplier, 1), 0.01);
      v_biomes := v_mount.allowed_biomes;
    end if;
  end if;

  v_cursor := v_pos.place_id;
  for v_step in select value from jsonb_array_elements(p_path) loop
    select * into v_route from map_routes where id = (v_step->>'route_id')::uuid;
    if not found then
      return jsonb_build_object('error', 'route_not_found',
        'message', 'Une route de cet itinéraire n''existe plus. Recalcule l''itinéraire.');
    end if;
    if v_route.from_place_id = v_cursor then
      v_to := v_route.to_place_id;
    elsif v_route.to_place_id = v_cursor then
      v_to := v_route.from_place_id;
    else
      return jsonb_build_object('error', 'route_not_connected',
        'message', 'Cet itinéraire ne part pas de ta position actuelle. Recalcule-le depuis là où tu es.');
    end if;
    if (v_step->>'to_place_id') is not null and (v_step->>'to_place_id')::uuid is distinct from v_to then
      return jsonb_build_object('error', 'route_not_connected',
        'message', 'Cet itinéraire ne part pas de ta position actuelle. Recalcule-le depuis là où tu es.');
    end if;

    if v_biomes is not null and cardinality(v_biomes) > 0 then
      select x, y into v_from_pt from map_places where id = v_route.from_place_id;
      select x, y into v_to_pt from map_places where id = v_route.to_place_id;
      v_blocked := path_blocked_biome(
        jsonb_build_array(jsonb_build_object('x', v_from_pt.x, 'y', v_from_pt.y))
          || coalesce(v_route.path_points, '[]'::jsonb)
          || jsonb_build_array(jsonb_build_object('x', v_to_pt.x, 'y', v_to_pt.y)),
        v_biomes);
      if v_blocked is not null then
        return jsonb_build_object('error', 'forbidden_biome', 'biome', v_blocked,
          'message', 'Ta monture ne peut pas traverser un biome de cet itinéraire (' || v_blocked || ').');
      end if;
    end if;

    v_min := round(coalesce(_route_walk_minutes(v_route.id), 30) / v_speed, 2);
    v_out := v_out || jsonb_build_array(jsonb_build_object('route_id', v_route.id, 'to_place_id', v_to, 'minutes', v_min));
    v_cursor := v_to;
  end loop;

  update character_positions set
    route_id = (v_out->0->>'route_id')::uuid,
    route_progress = 0,
    flight_target_place_id = null,
    travel_started_at = now(),
    travel_duration_minutes = (v_out->0->>'minutes')::numeric,
    planned_path = v_out,
    building_id = null,
    spawned = true
  where user_id = p_uid;

  return jsonb_build_object(
    'success', true,
    'destination', v_cursor,
    'steps', jsonb_array_length(v_out),
    'duration_minutes', (select sum((s->>'minutes')::numeric) from jsonb_array_elements(v_out) s)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Site principal : mêmes noms qu'avant.
-- ---------------------------------------------------------------------
create or replace function start_travel(p_planned_path jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v jsonb;
begin
  v := _start_route_plan(auth.uid(), p_planned_path);
  if v ? 'error' then
    raise exception '%', v->>'message';
  end if;
end;
$$;

create or replace function advance_my_travel()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform _travel_tick(auth.uid());
end;
$$;

-- Itinéraire depuis la Cartographie (renvoie un objet, pas d'exception).
create or replace function start_route_plan(p_planned_path jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  return _start_route_plan(auth.uid(), p_planned_path);
end;
$$;

-- ---------------------------------------------------------------------
-- Cartographie : une route (= itinéraire d'une étape) ou un vol libre.
-- ---------------------------------------------------------------------
create or replace function start_journey(p_route_id uuid, p_target_place_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_pos record;
  v_mount record;
  v_has_mount boolean := false;
  v_duration numeric;
  v_from record;
  v_to record;
  v_dist_units numeric;
  v_dist_km numeric;
  v_speed numeric;
  v_set record;
  v_blocked text;
begin
  if p_route_id is not null then
    return _start_route_plan(auth.uid(), jsonb_build_array(jsonb_build_object('route_id', p_route_id)));
  end if;

  if p_target_place_id is null then
    return jsonb_build_object('error', 'missing_target');
  end if;

  perform _travel_tick(auth.uid());
  select * into v_pos from character_positions where user_id = auth.uid() for update;
  if not found or v_pos.place_id is null then
    return jsonb_build_object('error', 'no_current_place');
  end if;
  if v_pos.travel_started_at is not null then
    return jsonb_build_object('error', 'already_traveling');
  end if;

  if v_pos.active_mount_id is not null
     and v_pos.mount_expires_at is not null and v_pos.mount_expires_at <= now() then
    update character_positions set active_mount_id = null, mount_expires_at = null where user_id = auth.uid();
    v_pos.active_mount_id := null;
  end if;
  if v_pos.active_mount_id is not null then
    select * into v_mount from mount_types where id = v_pos.active_mount_id;
    v_has_mount := found;
  end if;

  if not v_has_mount then
    return jsonb_build_object('error', 'no_flying_mount');
  end if;
  if v_mount.can_fly is not true then
    return jsonb_build_object('error', 'no_flying_mount');
  end if;
  if p_target_place_id = v_pos.place_id then
    return jsonb_build_object('error', 'same_place');
  end if;

  select x, y into v_from from map_places where id = v_pos.place_id;
  select x, y into v_to from map_places where id = p_target_place_id;
  if v_from is null or v_to is null then
    return jsonb_build_object('error', 'place_not_found');
  end if;

  select * into v_set from map_settings where id = 1;
  v_dist_units := sqrt(power(v_to.x - v_from.x, 2) + power(v_to.y - v_from.y, 2));
  v_dist_km := v_dist_units * coalesce(v_set.km_per_unit, 5);

  if v_mount.flight_range_km is not null and v_dist_km > v_mount.flight_range_km then
    return jsonb_build_object('error', 'out_of_range', 'distance_km', round(v_dist_km, 1),
                              'range_km', v_mount.flight_range_km);
  end if;

  if v_mount.allowed_biomes is not null and cardinality(v_mount.allowed_biomes) > 0 then
    v_blocked := path_blocked_biome(
      jsonb_build_array(jsonb_build_object('x', v_from.x, 'y', v_from.y),
                        jsonb_build_object('x', v_to.x, 'y', v_to.y)),
      v_mount.allowed_biomes);
    if v_blocked is not null then
      return jsonb_build_object('error', 'forbidden_biome', 'biome', v_blocked);
    end if;
  end if;

  v_speed := coalesce(v_mount.flight_speed_kmh,
                      coalesce(v_set.walk_kmh, 5) * coalesce(v_mount.speed_multiplier, 1));
  v_duration := greatest(2, round((v_dist_km / v_speed) * 60));

  update character_positions set
    route_id = null,
    route_progress = 0,
    flight_target_place_id = p_target_place_id,
    travel_started_at = now(),
    travel_duration_minutes = v_duration,
    planned_path = null,
    building_id = null
  where user_id = auth.uid();

  return jsonb_build_object('success', true, 'destination', p_target_place_id,
                            'duration_minutes', v_duration, 'distance_km', round(v_dist_km, 1));
end;
$$;

create or replace function arrive_at_destination()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v jsonb;
begin
  v := _travel_tick(auth.uid());
  if v->>'state' = 'arrived' then
    return jsonb_build_object('success', true, 'place_id', v->'place_id');
  elsif v->>'state' = 'traveling' then
    return jsonb_build_object('error', 'not_yet', 'remaining_minutes', v->'remaining_minutes');
  end if;
  return jsonb_build_object('error', 'not_traveling');
end;
$$;

-- ---------------------------------------------------------------------
-- Point de départ : une seule fois, jamais pendant un trajet, et le même
-- verrou des deux côtés.
-- ---------------------------------------------------------------------
create or replace function set_initial_place(p_place_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_existing record;
begin
  select * into v_existing from character_positions where user_id = auth.uid();
  if found and (v_existing.place_id is not null or v_existing.travel_started_at is not null or v_existing.spawned) then
    return jsonb_build_object('error', 'already_placed');
  end if;

  insert into character_positions (user_id, place_id, is_visible, arrived_at, spawned)
  values (auth.uid(), p_place_id, true, now(), true)
  on conflict (user_id) do update set
    place_id = excluded.place_id,
    arrived_at = now(),
    spawned = true
  where character_positions.place_id is null and character_positions.travel_started_at is null;

  return jsonb_build_object('success', true);
end;
$$;

create or replace function set_initial_position(
  p_place_id uuid,
  p_building_id uuid default null,
  p_note text default null,
  p_is_visible boolean default true
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_existing record;
begin
  if p_place_id is null then
    raise exception 'Choisis un lieu de départ.';
  end if;

  select * into v_existing from character_positions where user_id = auth.uid();
  if found and (coalesce(v_existing.spawned, false) or v_existing.place_id is not null or v_existing.travel_started_at is not null) then
    raise exception 'Tu as déjà un point de départ : déplace-toi avec un trajet plutôt que de te téléporter.';
  end if;

  insert into character_positions (user_id, place_id, building_id, note, is_visible, spawned, arrived_at, updated_at)
  values (auth.uid(), p_place_id, p_building_id, p_note, coalesce(p_is_visible, true), true, now(), now())
  on conflict (user_id) do update
    set place_id = excluded.place_id,
        building_id = excluded.building_id,
        note = excluded.note,
        is_visible = excluded.is_visible,
        spawned = true,
        arrived_at = now(),
        route_id = null,
        route_progress = null,
        travel_started_at = null,
        travel_duration_minutes = null,
        flight_target_place_id = null,
        planned_path = null,
        updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------
-- Positions : on renvoie aussi l'itinéraire (destination finale, étapes).
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
           cp.status, cp.arrived_at, cp.travel_started_at, cp.travel_duration_minutes,
           cp.flight_target_place_id, cp.planned_path,
           case when cp.mount_expires_at is null or cp.mount_expires_at > now()
                then cp.active_mount_id end as active_mount_id,
           case when cp.mount_expires_at is null or cp.mount_expires_at > now()
                then cp.mount_expires_at end as mount_expires_at,
           pr.nickname, pr.avatar_url, pr.member_rank
    from character_positions cp
    join profiles pr on pr.id = cp.user_id
    where cp.is_visible = true or cp.user_id = auth.uid()
    order by cp.updated_at desc
  ) t;
$$;

revoke execute on function _route_walk_minutes(uuid) from public, anon, authenticated;
revoke execute on function _travel_tick(uuid) from public, anon, authenticated;
revoke execute on function _start_route_plan(uuid, jsonb) from public, anon, authenticated;
grant execute on function start_route_plan(jsonb) to authenticated;
