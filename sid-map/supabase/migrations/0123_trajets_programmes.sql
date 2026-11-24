-- =====================================================================
-- 0123 — Lot 102 : trajets programmés. Rejouable. À lancer après la 0122
-- de la Cartographie (et la 0132 du Dossier Central pour le lancement
-- automatique chaque minute).
--
-- Un trajet se programme précisément :
--   - départ à la seconde (date et heure exactes), ou arrivée voulue :
--     l'heure de départ est alors calculée (durée estimée, hors météo) ;
--   - itinéraire étape par étape : chaque route choisie, dans l'ordre ;
--   - pauses chronométrées (1 min à 24 h) à un lieu de passage ;
--   - ou un vol direct avec une monture volante.
-- À l'heure dite, le serveur lance le trajet avec un départ daté
-- exactement de cette heure (même si la tâche de fond passe quelques
-- secondes plus tard) : chaque étape et l'arrivée tombent pile.
-- Si le trajet précédent n'est pas fini (météo), le départ a lieu à
-- l'arrivée exacte de celui-ci (6 h d'attente au plus). Si le membre n'est
-- pas au point de départ prévu, le trajet échoue et il est prévenu.
--
-- Les pauses deviennent des étapes du moteur de trajet (0113) : un trajet
-- lancé tout de suite peut aussi en contenir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Moteur : étapes de pause (reprise de _travel_tick, 0113)
--    Étape de pause dans planned_path : {"pause": true, "minutes": m,
--    "place_id": lieu}. Pendant la pause : route_id et
--    flight_target_place_id vides, place_id = le lieu, travel_started_at
--    et travel_duration_minutes = la pause.
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
  v_next jsonb;
  v_rest jsonb;
  v_next_route uuid;
  v_next_min numeric;
  v_name text;
  v_pause boolean;
  v_guard int := 0;
begin
  loop
    v_guard := v_guard + 1;
    if v_guard > 80 then
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

    v_first := v_pos.planned_path -> 0;
    v_pause := v_first is not null and coalesce((v_first->>'pause')::boolean, false)
               and v_pos.route_id is null and v_pos.flight_target_place_id is null;

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
        'pause', v_pause,
        'remaining_minutes', ceil(extract(epoch from (v_end - now())) / 60)
      );
    end if;

    -- Étape terminée : où arrive-t-on ?
    if v_pause then
      v_dest := v_pos.place_id;
    elsif v_pos.route_id is null then
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
    if v_first is not null and jsonb_array_length(v_pos.planned_path) > 1
       and (v_pause or (v_pos.route_id is not null and (v_first->>'route_id')::uuid = v_pos.route_id)) then
      v_rest := v_pos.planned_path - 0;
    end if;

    if v_rest is not null then
      v_next := v_rest -> 0;
      if coalesce((v_next->>'pause')::boolean, false) then
        update character_positions set
          place_id = v_dest,
          building_id = null,
          route_id = null,
          route_progress = null,
          flight_target_place_id = null,
          travel_started_at = v_end,
          travel_duration_minutes = (v_next->>'minutes')::numeric,
          planned_path = v_rest
        where user_id = p_uid;
      else
        v_next_route := (v_next->>'route_id')::uuid;
        v_next_min := coalesce((v_next->>'minutes')::numeric, _route_walk_minutes(v_next_route), 30);
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
      end if;
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
        null;
      end;

      return jsonb_build_object('state', 'arrived', 'place_id', v_dest);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Lancer un itinéraire à une heure donnée (reprise de
--    _start_route_plan, 0119), pauses comprises :
--    [{"route_id", "to_place_id"}, {"pause_minutes": 15}, ...]
-- ---------------------------------------------------------------------
create or replace function _start_route_plan_at(p_uid uuid, p_path jsonb, p_at timestamptz)
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
  v_pause numeric;
  v_n int := 0;
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
  if (p_path->0) ? 'pause_minutes' or (p_path->-1) ? 'pause_minutes' then
    return jsonb_build_object('error', 'pause_edge', 'message', 'Une pause se place entre deux routes, pas au début ni à la fin.');
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
    if v_step ? 'pause_minutes' then
      v_pause := (v_step->>'pause_minutes')::numeric;
      if v_pause is null or v_pause < 1 or v_pause > 1440 or v_pause <> round(v_pause) then
        return jsonb_build_object('error', 'bad_pause', 'message', 'Une pause dure de 1 minute à 24 heures, en minutes entières.');
      end if;
      v_n := v_n + 1;
      if v_n > 20 then
        return jsonb_build_object('error', 'too_many_pauses', 'message', '20 pauses au plus.');
      end if;
      v_out := v_out || jsonb_build_array(jsonb_build_object('pause', true, 'minutes', v_pause, 'place_id', v_cursor));
      continue;
    end if;

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
    select * into v_w from _route_weather(v_route.id, p_at);
    v_min := round(coalesce(_route_walk_minutes(v_route.id), 30) / v_speed * coalesce(v_w.factor, 1), 2);
    v_out := v_out || jsonb_build_array(jsonb_build_object('route_id', v_route.id, 'to_place_id', v_to, 'minutes', v_min,
                                                           'weather', v_w.kind, 'weather_factor', v_w.factor));
    v_cursor := v_to;
  end loop;

  update character_positions set
    route_id = (v_out->0->>'route_id')::uuid,
    route_progress = 0,
    flight_target_place_id = null,
    travel_started_at = p_at,
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

create or replace function _start_route_plan(p_uid uuid, p_path jsonb)
returns jsonb
language sql security definer set search_path = public
as $$
  select _start_route_plan_at(p_uid, p_path, now());
$$;

-- ---------------------------------------------------------------------
-- 3. Trajets programmés
-- ---------------------------------------------------------------------
create table if not exists trajets_programmes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  plan jsonb not null,
  from_place_id uuid references map_places (id) on delete set null,
  to_place_id uuid references map_places (id) on delete set null,
  depart_at timestamptz not null,
  arrivee_voulue timestamptz,
  minutes_estimees numeric not null default 0,
  statut text not null default 'programme' check (statut in ('programme', 'lance', 'annule', 'echoue')),
  created_at timestamptz not null default now(),
  lance_at timestamptz,
  depart_reel timestamptz,
  message text check (message is null or char_length(message) <= 300)
);
create index if not exists trajets_programmes_dus_idx on trajets_programmes (depart_at) where statut = 'programme';
create index if not exists trajets_programmes_user_idx on trajets_programmes (user_id, depart_at desc);
alter table trajets_programmes enable row level security;
revoke all on trajets_programmes from public, anon, authenticated;

-- Où sera le membre à une heure donnée : à l'arrivée du dernier trajet
-- programmé avant, sinon à la fin de son trajet en cours, sinon là où il est.
create or replace function _trajet_point_depart(p_uid uuid, p_avant timestamptz, p_sauf uuid default null)
returns uuid
language plpgsql stable security definer set search_path = public
as $$
declare
  v_pos record;
  v_to uuid;
begin
  select to_place_id into v_to from trajets_programmes
  where user_id = p_uid and statut = 'programme' and depart_at < p_avant and id is distinct from p_sauf
  order by depart_at desc limit 1;
  if v_to is not null then return v_to; end if;
  select * into v_pos from character_positions where user_id = p_uid;
  if not found then return null; end if;
  if v_pos.travel_started_at is not null then
    if v_pos.flight_target_place_id is not null then return v_pos.flight_target_place_id; end if;
    if v_pos.planned_path is not null and jsonb_array_length(v_pos.planned_path) > 0 then
      return coalesce((select (s->>'to_place_id')::uuid from jsonb_array_elements(v_pos.planned_path) with ordinality x(s, i)
                       where s ? 'to_place_id' order by i desc limit 1), v_pos.place_id);
    end if;
  end if;
  return v_pos.place_id;
end;
$$;

-- Vérifie un plan depuis un lieu et estime sa durée (monture actuelle,
-- hors météo). Renvoie {to_place_id, minutes} ou {error, message}.
create or replace function _trajet_estimer(p_uid uuid, p_plan jsonb, p_from uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_pos record;
  v_mount record;
  v_speed numeric := 1;
  v_set record;
  v_step jsonb;
  v_route record;
  v_cursor uuid := p_from;
  v_to uuid;
  v_total numeric := 0;
  v_n int := 0;
  v_p numeric;
  v_a record;
  v_b record;
  v_km numeric;
begin
  if p_from is null then
    return jsonb_build_object('error', 'no_current_place', 'message', 'Choisis d''abord ton point de départ sur la carte.');
  end if;
  if p_plan is null or jsonb_typeof(p_plan) <> 'array' or jsonb_array_length(p_plan) = 0 then
    return jsonb_build_object('error', 'empty_path', 'message', 'Trajet vide.');
  end if;
  if jsonb_array_length(p_plan) > 60 then
    return jsonb_build_object('error', 'path_too_long', 'message', 'Itinéraire trop long.');
  end if;
  select * into v_pos from character_positions where user_id = p_uid;
  if v_pos.active_mount_id is not null then
    select * into v_mount from mount_types where id = v_pos.active_mount_id;
    if found then v_speed := greatest(coalesce(v_mount.speed_multiplier, 1), 0.01); end if;
  end if;

  -- Vol direct.
  if (p_plan->0) ? 'vol_vers' then
    if jsonb_array_length(p_plan) > 1 then
      return jsonb_build_object('error', 'flight_alone', 'message', 'Un vol se programme seul, sans autre étape.');
    end if;
    if v_mount.id is null or v_mount.can_fly is not true then
      return jsonb_build_object('error', 'no_flying_mount', 'message', 'Il te faut une monture volante équipée.');
    end if;
    v_to := (p_plan->0->>'vol_vers')::uuid;
    if v_to = p_from then return jsonb_build_object('error', 'same_place', 'message', 'Tu y seras déjà.'); end if;
    select x, y into v_a from map_places where id = p_from;
    select x, y into v_b from map_places where id = v_to;
    if v_a is null or v_b is null then return jsonb_build_object('error', 'place_not_found', 'message', 'Lieu introuvable.'); end if;
    select * into v_set from map_settings where id = 1;
    v_km := sqrt(power(v_b.x - v_a.x, 2) + power(v_b.y - v_a.y, 2)) * coalesce(v_set.km_per_unit, 5);
    if v_mount.flight_range_km is not null and v_km > v_mount.flight_range_km then
      return jsonb_build_object('error', 'out_of_range', 'message', 'Hors de portée de ta monture (' || round(v_km) || ' km).');
    end if;
    return jsonb_build_object('to_place_id', v_to, 'minutes',
      greatest(2, round((v_km / coalesce(v_mount.flight_speed_kmh, coalesce(v_set.walk_kmh, 5) * coalesce(v_mount.speed_multiplier, 1))) * 60)));
  end if;

  if (p_plan->0) ? 'pause_minutes' or (p_plan->-1) ? 'pause_minutes' then
    return jsonb_build_object('error', 'pause_edge', 'message', 'Une pause se place entre deux routes, pas au début ni à la fin.');
  end if;
  for v_step in select value from jsonb_array_elements(p_plan) loop
    if v_step ? 'pause_minutes' then
      v_p := (v_step->>'pause_minutes')::numeric;
      if v_p is null or v_p < 1 or v_p > 1440 or v_p <> round(v_p) then
        return jsonb_build_object('error', 'bad_pause', 'message', 'Une pause dure de 1 minute à 24 heures, en minutes entières.');
      end if;
      v_n := v_n + 1;
      if v_n > 20 then return jsonb_build_object('error', 'too_many_pauses', 'message', '20 pauses au plus.'); end if;
      v_total := v_total + v_p;
      continue;
    end if;
    if v_step ? 'vol_vers' then
      return jsonb_build_object('error', 'flight_alone', 'message', 'Un vol se programme seul, sans autre étape.');
    end if;
    select * into v_route from map_routes where id = (v_step->>'route_id')::uuid;
    if not found then return jsonb_build_object('error', 'route_not_found', 'message', 'Une route de l''itinéraire n''existe pas.'); end if;
    if v_route.from_place_id = v_cursor then v_to := v_route.to_place_id;
    elsif v_route.to_place_id = v_cursor then v_to := v_route.from_place_id;
    else
      return jsonb_build_object('error', 'route_not_connected', 'message', 'L''itinéraire ne part pas du lieu où tu seras au départ.');
    end if;
    v_total := v_total + coalesce(_route_walk_minutes(v_route.id), 30) / v_speed;
    v_cursor := v_to;
  end loop;
  return jsonb_build_object('to_place_id', v_cursor, 'minutes', round(v_total, 2));
end;
$$;

-- Programmer : p_depart, ou p_arrivee (départ calculé). Renvoie le trajet.
create or replace function trajet_programmer(p_plan jsonb, p_depart timestamptz default null, p_arrivee timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_from uuid;
  v_est jsonb;
  v_depart timestamptz;
  v_fin timestamptz;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if (p_depart is null) = (p_arrivee is null) then raise exception 'Indique soit l''heure de départ, soit l''heure d''arrivée.'; end if;
  if (select count(*) from trajets_programmes where user_id = v_uid and statut = 'programme') >= 10 then
    raise exception 'Dix trajets programmés au plus.';
  end if;

  -- Point de départ : estimé une première fois avec l'heure donnée.
  v_from := _trajet_point_depart(v_uid, coalesce(p_depart, p_arrivee));
  v_est := _trajet_estimer(v_uid, p_plan, v_from);
  if v_est ? 'error' then raise exception '%', v_est->>'message'; end if;
  v_depart := coalesce(p_depart, p_arrivee - make_interval(secs => (v_est->>'minutes')::numeric * 60));
  if p_arrivee is not null then
    -- Départ calculé : le point de départ peut changer (trajet programmé avant).
    v_from := _trajet_point_depart(v_uid, v_depart);
    v_est := _trajet_estimer(v_uid, p_plan, v_from);
    if v_est ? 'error' then raise exception '%', v_est->>'message'; end if;
    v_depart := p_arrivee - make_interval(secs => (v_est->>'minutes')::numeric * 60);
  end if;
  v_depart := date_trunc('second', v_depart);
  if v_depart < now() then
    raise exception 'Départ dans le passé (%). Choisis une heure plus tardive.', to_char(v_depart at time zone stats_timezone(), 'DD/MM HH24:MI:SS');
  end if;
  if v_depart > now() + interval '60 days' then raise exception 'Soixante jours à l''avance au plus.'; end if;
  v_fin := v_depart + make_interval(secs => (v_est->>'minutes')::numeric * 60);

  -- Pas de chevauchement avec un autre trajet programmé (durées estimées).
  if exists (select 1 from trajets_programmes t where t.user_id = v_uid and t.statut = 'programme'
             and t.depart_at < v_fin and t.depart_at + make_interval(secs => t.minutes_estimees * 60) > v_depart) then
    raise exception 'Ce trajet chevauche un autre trajet programmé.';
  end if;

  insert into trajets_programmes (user_id, plan, from_place_id, to_place_id, depart_at, arrivee_voulue, minutes_estimees)
  values (v_uid, p_plan, v_from, (v_est->>'to_place_id')::uuid, v_depart, p_arrivee, (v_est->>'minutes')::numeric)
  returning id into v_id;
  return (select to_jsonb(t) from trajets_programmes t where id = v_id);
end;
$$;

-- Estimation pour l'interface (sans rien enregistrer).
create or replace function trajet_estimer(p_plan jsonb, p_depart timestamptz default null)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_from uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  v_from := _trajet_point_depart(auth.uid(), coalesce(p_depart, now() + interval '1 minute'));
  return _trajet_estimer(auth.uid(), p_plan, v_from) || jsonb_build_object('from_place_id', v_from);
end;
$$;

create or replace function trajet_annuler(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update trajets_programmes set statut = 'annule', message = 'Annulé par toi.'
  where id = p_id and user_id = auth.uid() and statut = 'programme';
  if not found then raise exception 'Trajet introuvable ou déjà parti.'; end if;
end;
$$;

create or replace function mes_trajets_programmes()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', t.id, 'plan', t.plan, 'depart_at', t.depart_at, 'arrivee_voulue', t.arrivee_voulue,
           'arrivee_estimee', t.depart_at + make_interval(secs => t.minutes_estimees * 60),
           'minutes_estimees', t.minutes_estimees, 'statut', t.statut, 'depart_reel', t.depart_reel, 'message', t.message,
           'from', (select name from map_places where id = t.from_place_id),
           'to', (select name from map_places where id = t.to_place_id))
         order by case t.statut when 'programme' then 0 else 1 end, t.depart_at), '[]'::jsonb)
  from (select * from trajets_programmes where user_id = auth.uid()
        and (statut = 'programme' or created_at > now() - interval '7 days')
        order by depart_at desc limit 30) t;
$$;

-- Lancement (chaque minute, et à chaque vérification du membre).
create or replace function trajets_programmes_lancer(p_uid uuid default null)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  t trajets_programmes;
  v_pos record;
  v_start timestamptz;
  v_res jsonb;
  v_name text;
  n int := 0;
  v_claims text;
begin
  for t in
    select * from trajets_programmes
    where statut = 'programme' and depart_at <= now() and (p_uid is null or user_id = p_uid)
    order by depart_at
    limit 100
    for update skip locked
  loop
    perform _travel_tick(t.user_id);
    select * into v_pos from character_positions where user_id = t.user_id;

    -- Encore en route : départ à l'arrivée exacte (6 h d'attente au plus).
    if v_pos.travel_started_at is not null then
      if now() > t.depart_at + interval '6 hours' then
        update trajets_programmes set statut = 'echoue', message = 'Toujours en route 6 h après l''heure prévue.' where id = t.id;
        perform _trajet_prevenir(t.user_id, 'Trajet programmé annulé', 'Tu étais encore en route 6 h après l''heure de départ prévue.');
      end if;
      continue;
    end if;
    if v_pos.place_id is distinct from t.from_place_id then
      update trajets_programmes set statut = 'echoue', message = 'Tu n''étais pas au point de départ prévu.' where id = t.id;
      select name into v_name from map_places where id = t.from_place_id;
      perform _trajet_prevenir(t.user_id, 'Trajet programmé annulé',
        'Il devait partir de ' || coalesce(v_name, 'son point de départ') || ', mais tu étais ailleurs.');
      continue;
    end if;

    v_start := greatest(t.depart_at, coalesce(v_pos.arrived_at, t.depart_at));
    if (t.plan->0) ? 'vol_vers' then
      -- Le vol passe par start_journey (0119), au nom du membre.
      v_claims := current_setting('request.jwt.claims', true);
      perform set_config('request.jwt.claims', json_build_object('sub', t.user_id, 'role', 'authenticated')::text, true);
      v_res := start_journey(null, (t.plan->0->>'vol_vers')::uuid);
      perform set_config('request.jwt.claims', coalesce(v_claims, ''), true);
      if v_res ? 'success' then
        update character_positions set travel_started_at = v_start where user_id = t.user_id;
      end if;
    else
      v_res := _start_route_plan_at(t.user_id, t.plan, v_start);
    end if;

    if v_res ? 'success' then
      update trajets_programmes set statut = 'lance', lance_at = now(), depart_reel = v_start,
        message = case when v_start > t.depart_at
                       then 'Parti à l''arrivée du trajet précédent, ' || _trajet_ecart(v_start - t.depart_at) || ' après l''heure prévue.' end
      where id = t.id;
      select name into v_name from map_places where id = t.to_place_id;
      perform _trajet_prevenir(t.user_id, 'Départ du trajet programmé',
        'En route vers ' || coalesce(v_name, 'ta destination') || ' depuis '
        || to_char(v_start at time zone stats_timezone(), 'HH24:MI:SS') || '.');
      perform _travel_tick(t.user_id);
      n := n + 1;
    else
      update trajets_programmes set statut = 'echoue', message = left(coalesce(v_res->>'message', v_res->>'error', 'Échec du départ.'), 300) where id = t.id;
      perform _trajet_prevenir(t.user_id, 'Trajet programmé annulé', coalesce(v_res->>'message', 'Le départ a échoué (' || coalesce(v_res->>'error', '?') || ').'));
    end if;
  end loop;
  return n;
end;
$$;

-- « 20 s », « 3 min 05 s », « 1 h 02 min ».
create or replace function _trajet_ecart(p interval)
returns text
language sql immutable
as $$
  select case
    when extract(epoch from p) < 60 then round(extract(epoch from p))::int || ' s'
    when extract(epoch from p) < 3600 then floor(extract(epoch from p) / 60)::int || ' min ' || lpad((round(extract(epoch from p))::int % 60)::text, 2, '0') || ' s'
    else floor(extract(epoch from p) / 3600)::int || ' h ' || lpad((floor(extract(epoch from p) / 60)::int % 60)::text, 2, '0') || ' min'
  end;
$$;

create or replace function _trajet_prevenir(p_uid uuid, p_title text, p_body text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  insert into notifications (user_id, type, title, body, link) values (p_uid, 'travel_arrived', p_title, p_body, '/carte');
exception when others then
  null;
end;
$$;

-- Vérification du membre (toutes les quelques secondes sur la carte) :
-- son trajet programmé part à l'heure, sans attendre la tâche de fond.
create or replace function advance_my_travel()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  perform trajets_programmes_lancer(auth.uid());
  perform _travel_tick(auth.uid());
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Droits
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    '_travel_tick(uuid)', '_start_route_plan_at(uuid, jsonb, timestamptz)', '_start_route_plan(uuid, jsonb)',
    '_trajet_point_depart(uuid, timestamptz, uuid)', '_trajet_estimer(uuid, jsonb, uuid)',
    'trajets_programmes_lancer(uuid)', '_trajet_prevenir(uuid, text, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'trajet_programmer(jsonb, timestamptz, timestamptz)', 'trajet_estimer(jsonb, timestamptz)',
    'trajet_annuler(uuid)', 'mes_trajets_programmes()', 'advance_my_travel()'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
