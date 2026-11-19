-- =====================================================================
-- 0119 — Météo et incursions
-- À lancer après 0118. Peut être relancée sans risque.
--
-- * Météo : chaque biome a son temps, qui change toutes les 3 heures
--   (tiré au sort selon le type de biome, le même pour tout le monde).
--   Un trajet prend la pire météo des biomes qu'il traverse au départ :
--   pluie ×1,15, brouillard ×1,25, orage ×1,5, vent arrière ×0,9…
--   La gestion de la carte peut imposer un temps à un biome.
-- * Incursions : toutes les 6 heures, une créature découverte du Wiki
--   (catégorie Mobs) peut apparaître et parcourir la carte pendant 3 heures.
--   Un membre arrêté sur un lieu proche peut la signaler : chaque
--   signalement compte dans la fiche du Wiki (« Où l'observer ») et
--   rapporte un peu de renommée. Un responsable des quêtes peut en faire
--   une quête de chasse.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Réglages
-- ---------------------------------------------------------------------
alter table map_settings add column if not exists weather_enabled boolean not null default true;
alter table map_settings add column if not exists incursions_enabled boolean not null default true;
-- Chance qu'une créature apparaisse dans une période de 6 heures.
alter table map_settings add column if not exists incursion_chance numeric not null default 0.6
  check (incursion_chance between 0 and 1);
-- Renommée gagnée pour un signalement.
alter table map_settings add column if not exists incursion_sight_reputation int not null default 2
  check (incursion_sight_reputation between 0 and 100);

-- ---------------------------------------------------------------------
-- 2. Météo
-- ---------------------------------------------------------------------
-- Types de temps : libellé et effet sur la durée des trajets.
create or replace function _weather_kinds()
returns jsonb
language sql immutable
as $$
  select '{
    "clair":         {"label": "Ciel clair",        "factor": 1},
    "nuageux":       {"label": "Nuageux",           "factor": 1},
    "vent":          {"label": "Vent arrière",      "factor": 0.9},
    "pluie":         {"label": "Pluie",             "factor": 1.15},
    "brouillard":    {"label": "Brouillard",        "factor": 1.25},
    "orage":         {"label": "Orage",             "factor": 1.5},
    "neige":         {"label": "Neige",             "factor": 1.4},
    "blizzard":      {"label": "Blizzard",          "factor": 1.7},
    "canicule":      {"label": "Canicule",          "factor": 1.25},
    "tempete_sable": {"label": "Tempête de sable",  "factor": 1.6},
    "cendres":       {"label": "Pluie de cendres",  "factor": 1.5}
  }'::jsonb;
$$;

-- Fréquence de chaque temps selon le type de biome.
create or replace function _weather_weights(p_biome_type text)
returns jsonb
language sql immutable
as $$
  select case p_biome_type
    when 'foret_dense'  then '{"clair":30,"nuageux":25,"pluie":25,"brouillard":15,"orage":5}'
    when 'jungle'       then '{"clair":20,"nuageux":20,"pluie":35,"orage":20,"brouillard":5}'
    when 'desert_aride' then '{"clair":55,"vent":15,"canicule":20,"tempete_sable":10}'
    when 'toundra'      then '{"clair":25,"nuageux":20,"neige":35,"blizzard":10,"brouillard":10}'
    when 'marecage'     then '{"brouillard":35,"pluie":25,"nuageux":25,"clair":15}'
    when 'montagneux'   then '{"clair":30,"vent":20,"neige":20,"brouillard":15,"orage":15}'
    when 'volcanique'   then '{"clair":25,"cendres":35,"vent":20,"orage":20}'
    else                     '{"clair":40,"nuageux":25,"vent":12,"pluie":15,"brouillard":5,"orage":3}'
  end::jsonb;
$$;

create table if not exists map_weather_overrides (
  biome_id uuid primary key references map_biomes (id) on delete cascade,
  kind text not null,
  until timestamptz not null,
  set_by uuid references profiles (id) on delete set null
);
alter table map_weather_overrides enable row level security;
drop policy if exists "map_weather_overrides_select" on map_weather_overrides;
create policy "map_weather_overrides_select" on map_weather_overrides for select using (auth.uid() is not null);

-- Période de 3 heures (numéro) d'un instant.
create or replace function _weather_slot(p_at timestamptz)
returns bigint
language sql immutable
as $$ select floor(extract(epoch from p_at) / 10800)::bigint; $$;

-- Temps d'un biome à un instant : tirage fixe (même résultat pour tous).
create or replace function _biome_weather(p_biome uuid, p_type text, p_at timestamptz)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_over map_weather_overrides;
  v_w jsonb := _weather_weights(p_type);
  v_total numeric := 0;
  v_roll numeric;
  v_acc numeric := 0;
  k text;
begin
  select * into v_over from map_weather_overrides where biome_id = p_biome and until > p_at;
  if v_over.biome_id is not null then return v_over.kind; end if;
  select sum(value::numeric) into v_total from jsonb_each_text(v_w);
  v_roll := (('x' || substr(md5(p_biome::text || ':' || _weather_slot(p_at)), 1, 8))::bit(32)::bigint)::numeric / 4294967296 * v_total;
  for k in select key from jsonb_each_text(v_w) order by key loop
    v_acc := v_acc + (v_w->>k)::numeric;
    if v_roll < v_acc then return k; end if;
  end loop;
  return 'clair';
end;
$$;

-- Pire temps parmi des points (biomes qui les contiennent).
create or replace function _points_weather(p_points jsonb, p_at timestamptz, out kind text, out factor numeric)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_on boolean;
  b record;
  pt jsonb;
  k text;
  f numeric;
begin
  select coalesce(weather_enabled, true) into v_on from map_settings order by id limit 1;
  if not coalesce(v_on, true) or p_points is null then
    kind := 'clair';
    factor := 1;
    return;
  end if;
  for b in select id, biome_type, path_points from map_biomes where is_published loop
    for pt in select value from jsonb_array_elements(p_points) loop
      if point_in_poly((pt->>'x')::numeric, (pt->>'y')::numeric, b.path_points) then
        k := _biome_weather(b.id, b.biome_type, p_at);
        f := coalesce((_weather_kinds()->k->>'factor')::numeric, 1);
        if factor is null or f > factor then
          kind := k;
          factor := f;
        end if;
        exit;
      end if;
    end loop;
  end loop;
  -- Hors de tout biome : temps clair.
  if factor is null then
    kind := 'clair';
    factor := 1;
  end if;
end;
$$;

-- Points d'échantillon d'une route : extrémités, points du tracé et milieux.
create or replace function _route_samples(p_route uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  r map_routes;
  a record;
  b record;
  pts jsonb;
  out jsonb := '[]'::jsonb;
  i int;
begin
  select * into r from map_routes where id = p_route;
  if r.id is null then return out; end if;
  select x, y into a from map_places where id = r.from_place_id;
  select x, y into b from map_places where id = r.to_place_id;
  pts := case when a.x is not null then jsonb_build_array(jsonb_build_object('x', a.x, 'y', a.y)) else '[]'::jsonb end
         || coalesce(r.path_points, '[]'::jsonb)
         || case when b.x is not null then jsonb_build_array(jsonb_build_object('x', b.x, 'y', b.y)) else '[]'::jsonb end;
  for i in 0..jsonb_array_length(pts) - 1 loop
    out := out || jsonb_build_array(pts->i);
    if i < jsonb_array_length(pts) - 1 then
      out := out || jsonb_build_array(jsonb_build_object(
        'x', ((pts->i->>'x')::numeric + (pts->(i+1)->>'x')::numeric) / 2,
        'y', ((pts->i->>'y')::numeric + (pts->(i+1)->>'y')::numeric) / 2));
    end if;
  end loop;
  return out;
end;
$$;

create or replace function _route_weather(p_route uuid, p_at timestamptz, out kind text, out factor numeric)
language sql stable security definer set search_path = public
as $$ select w.kind, w.factor from _points_weather(_route_samples(p_route), p_at) w; $$;

-- Météo actuelle et prochaine de chaque biome.
create or replace function map_weather_now()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_on boolean;
  v_slot bigint := _weather_slot(now());
  v_next timestamptz := to_timestamp((v_slot + 1) * 10800);
begin
  if auth.uid() is null then return null; end if;
  select coalesce(weather_enabled, true) into v_on from map_settings order by id limit 1;
  return jsonb_build_object(
    'enabled', coalesce(v_on, true),
    'kinds', _weather_kinds(),
    'changes_at', v_next,
    'biomes', case when coalesce(v_on, true) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'biome_type', b.biome_type,
        'kind', _biome_weather(b.id, b.biome_type, now()),
        'next', _biome_weather(b.id, b.biome_type, v_next + interval '1 minute'),
        'forced_until', (select until from map_weather_overrides o where o.biome_id = b.id and o.until > now())))
      from map_biomes b where b.is_published), '[]'::jsonb) else '[]'::jsonb end);
end;
$$;

-- Imposer un temps à un biome (gestion de la carte). p_kind vide : retour au tirage.
create or replace function map_weather_set(p_biome uuid, p_kind text, p_hours numeric default 3)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce(has_permission(auth.uid(), 'manage_map'), false) then
    raise exception 'Réservé à la gestion de la carte.';
  end if;
  if p_kind is null or p_kind = '' then
    delete from map_weather_overrides where biome_id = p_biome;
    return;
  end if;
  if not _weather_kinds() ? p_kind then raise exception 'Temps inconnu.'; end if;
  if p_hours is null or p_hours <= 0 or p_hours > 168 then raise exception 'Durée de 1 à 168 heures.'; end if;
  insert into map_weather_overrides (biome_id, kind, until, set_by)
  values (p_biome, p_kind, now() + make_interval(secs => p_hours * 3600), auth.uid())
  on conflict (biome_id) do update set kind = excluded.kind, until = excluded.until, set_by = excluded.set_by;
end;
$$;

-- Réglages météo et incursions (gestion de la carte).
create or replace function map_events_set(p_weather boolean, p_incursions boolean, p_chance numeric, p_reputation int)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce(has_permission(auth.uid(), 'manage_map'), false) then
    raise exception 'Réservé à la gestion de la carte.';
  end if;
  if p_chance is not null and (p_chance < 0 or p_chance > 1) then raise exception 'Chance de 0 à 100 %%.'; end if;
  if p_reputation is not null and (p_reputation < 0 or p_reputation > 100) then raise exception 'Renommée de 0 à 100.'; end if;
  update map_settings set
    weather_enabled = coalesce(p_weather, weather_enabled),
    incursions_enabled = coalesce(p_incursions, incursions_enabled),
    incursion_chance = coalesce(p_chance, incursion_chance),
    incursion_sight_reputation = coalesce(p_reputation, incursion_sight_reputation),
    updated_at = now()
  where id = (select id from map_settings order by id limit 1);
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Trajets : la météo allonge ou raccourcit la durée
--    (reprend 0113 ; seul le calcul de durée change)
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
  v_w record;
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

    -- Météo (0119) : la pire du trajet, au moment du départ.
    select * into v_w from _route_weather(v_route.id, now());
    v_min := round(coalesce(_route_walk_minutes(v_route.id), 30) / v_speed * coalesce(v_w.factor, 1), 2);
    v_out := v_out || jsonb_build_array(jsonb_build_object('route_id', v_route.id, 'to_place_id', v_to, 'minutes', v_min,
                                                           'weather', v_w.kind, 'weather_factor', v_w.factor));
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
  v_w record;
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
  -- Météo (0119) : celle du point de départ et de l'arrivée, la pire des deux.
  select * into v_w from _points_weather(jsonb_build_array(jsonb_build_object('x', v_from.x, 'y', v_from.y),
                                                           jsonb_build_object('x', v_to.x, 'y', v_to.y)), now());
  v_duration := greatest(2, round((v_dist_km / v_speed) * 60 * coalesce(v_w.factor, 1)));

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
                            'duration_minutes', v_duration, 'distance_km', round(v_dist_km, 1),
                            'weather', v_w.kind, 'weather_factor', v_w.factor);
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Incursions
-- ---------------------------------------------------------------------
create table if not exists map_incursions (
  id uuid primary key default gen_random_uuid(),
  slot bigint not null unique,                 -- période de 6 heures
  entry_id uuid references wiki_entries (id) on delete set null,  -- vide : pas de créature cette fois
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  path jsonb not null default '[]'::jsonb,     -- [{x, y}] parcourus à vitesse régulière
  quest_id uuid references quests (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table map_incursions enable row level security;
drop policy if exists "map_incursions_select" on map_incursions;
create policy "map_incursions_select" on map_incursions for select using (auth.uid() is not null);

create table if not exists wiki_sightings (
  id bigserial primary key,
  entry_id uuid not null references wiki_entries (id) on delete cascade,
  incursion_id uuid references map_incursions (id) on delete set null,
  user_id uuid not null references profiles (id) on delete cascade,
  place_id uuid references map_places (id) on delete set null,
  x numeric not null,
  y numeric not null,
  created_at timestamptz not null default now(),
  unique (incursion_id, user_id)
);
create index if not exists wiki_sightings_entry_idx on wiki_sightings (entry_id, created_at desc);
alter table wiki_sightings enable row level security;
drop policy if exists "wiki_sightings_select" on wiki_sightings;
create policy "wiki_sightings_select" on wiki_sightings for select using (auth.uid() is not null);

-- Position sur le parcours (fraction 0 à 1 de la longueur).
create or replace function _incursion_pos(p_path jsonb, p_frac numeric, out x numeric, out y numeric)
language plpgsql immutable
as $$
declare
  n int := jsonb_array_length(coalesce(p_path, '[]'::jsonb));
  total numeric := 0;
  seg numeric;
  goal numeric;
  i int;
  ax numeric; ay numeric; bx numeric; by_ numeric;
begin
  if n = 0 then return; end if;
  x := (p_path->0->>'x')::numeric; y := (p_path->0->>'y')::numeric;
  if n = 1 then return; end if;
  for i in 0..n-2 loop
    total := total + sqrt(power((p_path->(i+1)->>'x')::numeric - (p_path->i->>'x')::numeric, 2)
                        + power((p_path->(i+1)->>'y')::numeric - (p_path->i->>'y')::numeric, 2));
  end loop;
  goal := greatest(0, least(1, p_frac)) * total;
  for i in 0..n-2 loop
    ax := (p_path->i->>'x')::numeric; ay := (p_path->i->>'y')::numeric;
    bx := (p_path->(i+1)->>'x')::numeric; by_ := (p_path->(i+1)->>'y')::numeric;
    seg := sqrt(power(bx - ax, 2) + power(by_ - ay, 2));
    if goal <= seg or i = n - 2 then
      x := ax + (bx - ax) * case when seg > 0 then least(1, goal / seg) else 0 end;
      y := ay + (by_ - ay) * case when seg > 0 then least(1, goal / seg) else 0 end;
      return;
    end if;
    goal := goal - seg;
  end loop;
end;
$$;

-- Parcours au hasard le long des routes (5 étapes au plus).
create or replace function _incursion_path()
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_cur uuid;
  v_prev uuid;
  v_next record;
  v_pt record;
  v_path jsonb := '[]'::jsonb;
  i int;
begin
  select id, x, y into v_pt from map_places where is_published order by random() limit 1;
  if v_pt.id is null then return v_path; end if;
  v_cur := v_pt.id;
  v_path := jsonb_build_array(jsonb_build_object('x', v_pt.x, 'y', v_pt.y));
  for i in 1..5 loop
    select r.path_points, r.from_place_id, r.to_place_id,
           case when r.from_place_id = v_cur then r.to_place_id else r.from_place_id end as other
      into v_next
      from map_routes r
     where r.is_published and (r.from_place_id = v_cur or r.to_place_id = v_cur)
       and (case when r.from_place_id = v_cur then r.to_place_id else r.from_place_id end) is distinct from v_prev
     order by random() limit 1;
    if v_next.other is null then
      -- Pas de route : saut vers un lieu au hasard.
      select id, x, y into v_pt from map_places where is_published and id <> v_cur order by random() limit 1;
      exit when v_pt.id is null;
      v_prev := v_cur; v_cur := v_pt.id;
      v_path := v_path || jsonb_build_array(jsonb_build_object('x', v_pt.x, 'y', v_pt.y));
      continue;
    end if;
    -- Le tracé de la route, dans le sens du parcours.
    if jsonb_array_length(coalesce(v_next.path_points, '[]'::jsonb)) > 0 then
      v_path := v_path || case when v_next.from_place_id = v_cur then v_next.path_points
                               else (select jsonb_agg(e order by o desc) from jsonb_array_elements(v_next.path_points) with ordinality t(e, o)) end;
    end if;
    select x, y into v_pt from map_places where id = v_next.other;
    v_path := v_path || jsonb_build_array(jsonb_build_object('x', v_pt.x, 'y', v_pt.y));
    v_prev := v_cur; v_cur := v_next.other;
  end loop;
  return v_path;
end;
$$;

-- Incursion de la période en cours (créée au premier appel de la période).
create or replace function map_incursion_current()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  s map_settings;
  v_slot bigint := floor(extract(epoch from now()) / 21600)::bigint;
  v_start timestamptz := to_timestamp(v_slot * 21600);
  v_entry uuid;
  v_inc map_incursions;
  w wiki_entries;
  v_pos record;
  v_frac numeric;
  v_begin timestamptz;
  v_end timestamptz;
begin
  if v_uid is null then return null; end if;
  select * into s from map_settings order by id limit 1;
  if not coalesce(s.incursions_enabled, true) then return jsonb_build_object('enabled', false); end if;

  if not exists (select 1 from map_incursions where slot = v_slot) then
    if random() < coalesce(s.incursion_chance, 0.6) then
      select id into v_entry from wiki_entries where category = 'mobs' and discovered order by random() limit 1;
    end if;
    -- Apparition dans les 2 premières heures de la période (ou tout de suite
    -- si la période est déjà entamée), pour 3 heures, sans déborder sur la
    -- période suivante. Moins d'une heure possible : pas de créature.
    v_begin := greatest(now(), v_start + make_interval(secs => floor(random() * 7200)));
    v_end := least(v_begin + interval '3 hours', v_start + interval '6 hours');
    if v_end - v_begin < interval '1 hour' then v_entry := null; end if;
    insert into map_incursions (slot, entry_id, starts_at, ends_at, path)
    values (v_slot, v_entry, v_begin, v_end,
            case when v_entry is null then '[]'::jsonb else _incursion_path() end)
    on conflict (slot) do nothing;
  end if;

  select * into v_inc from map_incursions where slot = v_slot;
  if v_inc.entry_id is null or jsonb_array_length(v_inc.path) = 0 or now() > v_inc.ends_at then
    return jsonb_build_object('enabled', true, 'active', null, 'next_at', to_timestamp((v_slot + 1) * 21600));
  end if;
  select * into w from wiki_entries where id = v_inc.entry_id;
  v_frac := extract(epoch from (now() - v_inc.starts_at)) / extract(epoch from (v_inc.ends_at - v_inc.starts_at));
  select * into v_pos from _incursion_pos(v_inc.path, v_frac);

  return jsonb_build_object(
    'enabled', true,
    'next_at', to_timestamp((v_slot + 1) * 21600),
    'active', jsonb_build_object(
      'id', v_inc.id, 'starts_at', v_inc.starts_at, 'ends_at', v_inc.ends_at, 'path', v_inc.path,
      'started', now() >= v_inc.starts_at,
      'x', round(v_pos.x, 3), 'y', round(v_pos.y, 3), 'quest_id', v_inc.quest_id,
      'entry', jsonb_build_object('category', w.category, 'number', w.number, 'title', w.title,
                                  'summary', w.summary, 'image_url', w.image_url, 'rarity', w.rarity),
      'sightings', (select count(*) from wiki_sightings where incursion_id = v_inc.id),
      'seen_by_me', exists (select 1 from wiki_sightings where incursion_id = v_inc.id and user_id = v_uid),
      'reach', coalesce(s.world_size, 100) * 0.08,
      'km_per_unit', coalesce(s.km_per_unit, 5)));
end;
$$;

-- Signaler la créature : il faut être arrêté sur un lieu assez proche.
create or replace function incursion_sight(p_incursion uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  s map_settings;
  v_inc map_incursions;
  v_cp character_positions;
  v_place map_places;
  v_pos record;
  v_frac numeric;
  v_dist numeric;
  v_reach numeric;
  v_rep int;
  v_title text;
begin
  if v_uid is null then raise exception 'Connexion requise.'; end if;
  perform _travel_tick(v_uid);
  select * into s from map_settings order by id limit 1;
  select * into v_inc from map_incursions where id = p_incursion;
  if v_inc.id is null or v_inc.entry_id is null then raise exception 'Aucune créature à signaler.'; end if;
  if now() < v_inc.starts_at then raise exception 'La créature n''est pas encore apparue.'; end if;
  if now() > v_inc.ends_at then raise exception 'La créature est repartie.'; end if;
  if exists (select 1 from wiki_sightings where incursion_id = v_inc.id and user_id = v_uid) then
    raise exception 'Tu l''as déjà signalée.';
  end if;

  select * into v_cp from character_positions where user_id = v_uid;
  if v_cp.user_id is null or v_cp.place_id is null then raise exception 'Choisis d''abord ta position sur la carte.'; end if;
  if v_cp.travel_started_at is not null then raise exception 'Arrête-toi sur un lieu pour l''observer.'; end if;
  if coalesce(v_cp.glitched, false) then raise exception 'Personne ne te voit, et tu ne vois rien d''ici.'; end if;
  select * into v_place from map_places where id = v_cp.place_id;

  v_frac := extract(epoch from (now() - v_inc.starts_at)) / extract(epoch from (v_inc.ends_at - v_inc.starts_at));
  select * into v_pos from _incursion_pos(v_inc.path, v_frac);
  v_dist := sqrt(power(v_pos.x - v_place.x, 2) + power(v_pos.y - v_place.y, 2));
  v_reach := coalesce(s.world_size, 100) * 0.08;
  if v_dist > v_reach then
    raise exception 'Trop loin : elle est à % km de toi (% km au plus).',
      round(v_dist * coalesce(s.km_per_unit, 5)), round(v_reach * coalesce(s.km_per_unit, 5));
  end if;

  insert into wiki_sightings (entry_id, incursion_id, user_id, place_id, x, y)
  values (v_inc.entry_id, v_inc.id, v_uid, v_place.id, round(v_pos.x, 2), round(v_pos.y, 2));

  v_rep := coalesce(s.incursion_sight_reputation, 2);
  select title into v_title from wiki_entries where id = v_inc.entry_id;
  if v_rep > 0 and not exists (select 1 from sandbox_accounts where user_id = v_uid) then
    update profiles set reputation = coalesce(reputation, 0) + v_rep where id = v_uid;
  end if;
  insert into notifications (user_id, type, title, body, link)
  values (v_uid, 'incursion', 'Signalement enregistré',
          'Observation : ' || coalesce(v_title, 'la créature') || ', près de ' || v_place.name
          || case when v_rep > 0 then ' (+' || v_rep || ' de renommée).' else '.' end, null);

  return jsonb_build_object('ok', true, 'reputation', v_rep,
                            'sightings', (select count(*) from wiki_sightings where incursion_id = v_inc.id));
end;
$$;

-- Quête de chasse à partir d'une incursion (responsables des quêtes).
create or replace function incursion_hunt_quest(p_incursion uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inc map_incursions;
  w wiki_entries;
  v_pos record;
  v_frac numeric;
  v_place uuid;
  v_id uuid;
begin
  if not coalesce(has_permission(v_uid, 'manage_quests'), false) then
    raise exception 'Réservé aux responsables des quêtes.';
  end if;
  select * into v_inc from map_incursions where id = p_incursion for update;
  if v_inc.id is null or v_inc.entry_id is null or now() > v_inc.ends_at then raise exception 'Aucune créature en cours.'; end if;
  if v_inc.quest_id is not null then return v_inc.quest_id; end if;
  select * into w from wiki_entries where id = v_inc.entry_id;
  v_frac := greatest(0, extract(epoch from (now() - v_inc.starts_at)) / extract(epoch from (v_inc.ends_at - v_inc.starts_at)));
  select * into v_pos from _incursion_pos(v_inc.path, v_frac);
  select id into v_place from map_places where is_published
   order by power(x - v_pos.x, 2) + power(y - v_pos.y, 2) limit 1;

  insert into quests (title, description, reward, difficulty, deadline, status, visibility, contract_type,
                      funded_by_creator, giver, objectives, place_id, reputation_reward, created_by)
  values ('Chasse : ' || coalesce(w.title, 'créature inconnue'),
          coalesce(w.title, 'Une créature') || ' rôde sur la carte. Retrouve-la avant qu''elle ne reparte et signale-la depuis la Cartographie.',
          0, case when coalesce(w.rarity, 1) >= 5 then 'A' when coalesce(w.rarity, 1) >= 3 then 'B' else 'C' end,
          v_inc.ends_at, 'open', 'members', 'chasse', false, 'Le Wiki',
          array['Retrouver la créature sur la carte', 'La signaler depuis un lieu proche'],
          null, 10 + 5 * coalesce(w.rarity, 1), v_uid)
  returning id into v_id;
  update map_incursions set quest_id = v_id where id = v_inc.id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Wiki : où observer une créature
-- ---------------------------------------------------------------------
create or replace function wiki_entry_sightings(p_category text, p_number int)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  w wiki_entries;
  s map_settings;
begin
  if not public.wiki_can_read() then raise exception 'Accès refusé' using errcode = '42501'; end if;
  select * into w from wiki_entries where category = p_category and number = p_number;
  if w.id is null or not w.discovered then return null; end if;
  select * into s from map_settings order by id limit 1;
  return jsonb_build_object(
    'world', coalesce(s.world_size, 100),
    'zones', coalesce((select jsonb_agg(z.path_points) from map_zones z where z.is_published and z.type in ('continent', 'ile')), '[]'::jsonb),
    'places', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'x', p.x, 'y', p.y))
                        from wiki_entry_places l join map_places p on p.id = l.place_id
                        where l.entry_id = w.id and p.is_published), '[]'::jsonb),
    'sightings', coalesce((select jsonb_agg(jsonb_build_object('x', ws.x, 'y', ws.y, 'at', ws.created_at, 'place', pl.name) order by ws.created_at desc)
                           from (select * from wiki_sightings where entry_id = w.id order by created_at desc limit 200) ws
                           left join map_places pl on pl.id = ws.place_id), '[]'::jsonb),
    'count', (select count(*) from wiki_sightings where entry_id = w.id),
    'last_at', (select max(created_at) from wiki_sightings where entry_id = w.id)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Droits
-- ---------------------------------------------------------------------
revoke execute on function _biome_weather(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function _points_weather(jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function _route_samples(uuid) from public, anon, authenticated;
revoke execute on function _route_weather(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function _incursion_path() from public, anon, authenticated;
revoke execute on function map_weather_now() from public, anon;
revoke execute on function map_weather_set(uuid, text, numeric) from public, anon;
revoke execute on function map_events_set(boolean, boolean, numeric, int) from public, anon;
revoke execute on function map_incursion_current() from public, anon;
revoke execute on function incursion_sight(uuid) from public, anon;
revoke execute on function incursion_hunt_quest(uuid) from public, anon;
revoke execute on function wiki_entry_sightings(text, int) from public, anon;
grant execute on function map_weather_now() to authenticated;
grant execute on function map_weather_set(uuid, text, numeric) to authenticated;
grant execute on function map_events_set(boolean, boolean, numeric, int) to authenticated;
grant execute on function map_incursion_current() to authenticated;
grant execute on function incursion_sight(uuid) to authenticated;
grant execute on function incursion_hunt_quest(uuid) to authenticated;
grant execute on function wiki_entry_sightings(text, int) to authenticated;
