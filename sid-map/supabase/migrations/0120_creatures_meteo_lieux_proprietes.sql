-- =====================================================================
-- 0120 — Créatures, météo des lieux, propriétaires des lieux-bâtiments
-- À lancer après 0119. Peut être relancée sans risque.
--
-- * Créatures : la gestion de la carte choisit les créatures (Mobs du
--   Wiki) qui peuvent rôder, leur fréquence, les lieux et biomes où elles
--   peuvent ou non apparaître, et des lieux interdits à toutes. Elle peut
--   aussi en faire apparaître une tout de suite, ou renvoyer celle en cours.
--   Une créature pas encore découverte peut être ajoutée : elle rôde sous
--   le nom « Créature inconnue », et le premier signalement la révèle dans
--   le Wiki (signaleur = découvreur).
-- * Météo des lieux : un lieu peut garder un temps fixe, refuser certains
--   temps, ou avoir ses propres probabilités. Sans règle, il suit le biome.
--   Le temps d'un lieu compte pour les trajets qui en partent ou y arrivent.
-- * Propriétaire : un lieu qui est un bâtiment éditable peut être donné à
--   un membre. Il peut alors modifier ses étages, sa description et son
--   image. Le nouveau propriétaire est prévenu (bâtiments des villes aussi).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Créatures
-- ---------------------------------------------------------------------
create table if not exists map_creatures (
  entry_id uuid primary key references wiki_entries (id) on delete cascade,
  enabled boolean not null default true,          -- false : ne rôde jamais
  weight int not null default 1 check (weight between 1 and 20),
  allow_places uuid[] not null default '{}',     -- vide (et biomes vides) : partout
  allow_biomes uuid[] not null default '{}',
  deny_places uuid[] not null default '{}',
  deny_biomes uuid[] not null default '{}',
  updated_by uuid references profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table map_creatures enable row level security;
drop policy if exists "map_creatures_select" on map_creatures;
create policy "map_creatures_select" on map_creatures for select
  using (coalesce(has_permission(auth.uid(), 'manage_map'), false));

-- Lieux et biomes interdits à toutes les créatures.
alter table map_settings add column if not exists creature_deny_places uuid[] not null default '{}';
alter table map_settings add column if not exists creature_deny_biomes uuid[] not null default '{}';

-- Créature placée à la main (peut déborder sur la période suivante).
alter table map_incursions add column if not exists manual boolean not null default false;
alter table map_incursions add column if not exists set_by uuid references profiles (id) on delete set null;

-- Le point (x, y) est-il dans l'un de ces biomes ?
create or replace function _in_biomes(p_x numeric, p_y numeric, p_ids uuid[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(array_length(p_ids, 1), 0) > 0
     and exists (select 1 from map_biomes b where b.id = any (p_ids) and point_in_poly(p_x, p_y, b.path_points));
$$;

-- Une créature peut-elle se trouver sur ce lieu ?
create or replace function _creature_place_ok(p_entry uuid, p_place uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  p map_places;
  s map_settings;
  r map_creatures;
begin
  select * into p from map_places where id = p_place;
  if p.id is null or not p.is_published then return false; end if;
  select * into s from map_settings order by id limit 1;
  if p.id = any (coalesce(s.creature_deny_places, '{}')) or _in_biomes(p.x, p.y, s.creature_deny_biomes) then
    return false;
  end if;
  select * into r from map_creatures where entry_id = p_entry;
  if r.entry_id is null then return true; end if;
  if p.id = any (r.deny_places) or _in_biomes(p.x, p.y, r.deny_biomes) then return false; end if;
  if coalesce(array_length(r.allow_places, 1), 0) = 0 and coalesce(array_length(r.allow_biomes, 1), 0) = 0 then
    return true;
  end if;
  return p.id = any (r.allow_places) or _in_biomes(p.x, p.y, r.allow_biomes);
end;
$$;

-- Créatures qui peuvent rôder : choisies à la main, sinon les Mobs découverts.
create or replace function _creature_pool()
returns table (entry_id uuid, weight int)
language sql stable security definer set search_path = public
as $$
  select w.id, coalesce(c.weight, 1)
    from wiki_entries w
    left join map_creatures c on c.entry_id = w.id
   where w.category = 'mobs'
     and coalesce(c.enabled, w.discovered);
$$;

-- Tirage d'une créature (selon sa fréquence) qui a au moins un lieu possible.
create or replace function _creature_pick()
returns uuid
language sql volatile security definer set search_path = public
as $$
  with pool as (
    select cp.entry_id, cp.weight from _creature_pool() cp
     where exists (select 1 from map_places pl where pl.is_published and _creature_place_ok(cp.entry_id, pl.id))
  ),
  roll as materialized (select random() * sum(weight) as r from pool),
  acc as (select entry_id, sum(weight) over (order by entry_id) as a from pool)
  select acc.entry_id from acc, roll where acc.a > roll.r order by acc.a limit 1;
$$;

-- Parcours le long des routes (5 étapes au plus), sans quitter les lieux
-- permis à la créature. p_start : lieu de départ imposé (sinon au hasard).
drop function if exists _incursion_path();
create or replace function _incursion_path(p_entry uuid, p_start uuid default null)
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
  if p_start is not null then
    select id, x, y into v_pt from map_places where id = p_start;
  else
    select id, x, y into v_pt from map_places pl
     where pl.is_published and _creature_place_ok(p_entry, pl.id) order by random() limit 1;
  end if;
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
       and _creature_place_ok(p_entry, case when r.from_place_id = v_cur then r.to_place_id else r.from_place_id end)
     order by random() limit 1;
    if v_next.other is null then
      -- Pas de route permise : saut vers un autre lieu permis, s'il y en a.
      select id, x, y into v_pt from map_places pl
       where pl.is_published and pl.id <> v_cur and _creature_place_ok(p_entry, pl.id)
       order by random() limit 1;
      exit when v_pt.id is null;
      v_prev := v_cur; v_cur := v_pt.id;
      v_path := v_path || jsonb_build_array(jsonb_build_object('x', v_pt.x, 'y', v_pt.y));
      continue;
    end if;
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

-- Fiche d'une créature telle que les membres la voient.
create or replace function _creature_card(p_entry uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select case when w.discovered
    then jsonb_build_object('category', w.category, 'number', w.number, 'title', w.title,
                            'summary', w.summary, 'image_url', w.image_url, 'rarity', w.rarity, 'unknown', false)
    else jsonb_build_object('category', w.category, 'number', null, 'title', 'Créature inconnue',
                            'summary', 'Personne ne l''a encore signalée. Le premier à la voir la révélera dans le Wiki.',
                            'image_url', null, 'rarity', w.rarity, 'unknown', true)
  end
  from wiki_entries w where w.id = p_entry;
$$;

-- Créature en cours : placée à la main, sinon celle de la période de 6 heures
-- (tirée au premier appel de la période).
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
  v_pos record;
  v_frac numeric;
  v_begin timestamptz;
  v_end timestamptz;
begin
  if v_uid is null then return null; end if;
  select * into s from map_settings order by id limit 1;
  if not coalesce(s.incursions_enabled, true) then return jsonb_build_object('enabled', false); end if;

  select * into v_inc from map_incursions
   where manual and entry_id is not null and ends_at > now()
   order by starts_at desc limit 1;

  if v_inc.id is null then
    if not exists (select 1 from map_incursions where slot = v_slot) then
      if random() < coalesce(s.incursion_chance, 0.6) then
        v_entry := _creature_pick();
      end if;
      v_begin := greatest(now(), v_start + make_interval(secs => floor(random() * 7200)));
      v_end := least(v_begin + interval '3 hours', v_start + interval '6 hours');
      if v_end - v_begin < interval '1 hour' then v_entry := null; end if;
      insert into map_incursions (slot, entry_id, starts_at, ends_at, path)
      values (v_slot, v_entry, v_begin, v_end,
              case when v_entry is null then '[]'::jsonb else _incursion_path(v_entry) end)
      on conflict (slot) do nothing;
    end if;
    select * into v_inc from map_incursions where slot = v_slot;
  end if;

  if v_inc.entry_id is null or jsonb_array_length(v_inc.path) = 0 or now() > v_inc.ends_at then
    return jsonb_build_object('enabled', true, 'active', null, 'next_at', to_timestamp((v_slot + 1) * 21600));
  end if;
  v_frac := extract(epoch from (now() - v_inc.starts_at)) / greatest(1, extract(epoch from (v_inc.ends_at - v_inc.starts_at)));
  select * into v_pos from _incursion_pos(v_inc.path, v_frac);

  return jsonb_build_object(
    'enabled', true,
    'next_at', to_timestamp((v_slot + 1) * 21600),
    'active', jsonb_build_object(
      'id', v_inc.id, 'starts_at', v_inc.starts_at, 'ends_at', v_inc.ends_at, 'path', v_inc.path,
      'started', now() >= v_inc.starts_at, 'manual', v_inc.manual,
      'x', round(v_pos.x, 3), 'y', round(v_pos.y, 3), 'quest_id', v_inc.quest_id,
      'entry', _creature_card(v_inc.entry_id),
      'sightings', (select count(*) from wiki_sightings where incursion_id = v_inc.id),
      'seen_by_me', exists (select 1 from wiki_sightings where incursion_id = v_inc.id and user_id = v_uid),
      'reach', coalesce(s.world_size, 100) * 0.08,
      'km_per_unit', coalesce(s.km_per_unit, 5)));
end;
$$;

-- Signaler la créature (reprend 0119) : le premier signalement d'une
-- créature inconnue la révèle dans le Wiki.
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
  v_revealed boolean := false;
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

  v_frac := extract(epoch from (now() - v_inc.starts_at)) / greatest(1, extract(epoch from (v_inc.ends_at - v_inc.starts_at)));
  select * into v_pos from _incursion_pos(v_inc.path, v_frac);
  v_dist := sqrt(power(v_pos.x - v_place.x, 2) + power(v_pos.y - v_place.y, 2));
  v_reach := coalesce(s.world_size, 100) * 0.08;
  if v_dist > v_reach then
    raise exception 'Trop loin : elle est à % km de toi (% km au plus).',
      round(v_dist * coalesce(s.km_per_unit, 5)), round(v_reach * coalesce(s.km_per_unit, 5));
  end if;

  insert into wiki_sightings (entry_id, incursion_id, user_id, place_id, x, y)
  values (v_inc.entry_id, v_inc.id, v_uid, v_place.id, round(v_pos.x, 2), round(v_pos.y, 2));

  -- Créature inconnue : révélée par ce signalement (sauf comptes de test).
  if not exists (select 1 from sandbox_accounts where user_id = v_uid) then
    update wiki_entries set discovered = true, discovered_at = now(), discovered_by = v_uid
     where id = v_inc.entry_id and not discovered;
    v_revealed := found;
  end if;

  v_rep := coalesce(s.incursion_sight_reputation, 2);
  select title into v_title from wiki_entries where id = v_inc.entry_id and discovered;
  if v_rep > 0 and not exists (select 1 from sandbox_accounts where user_id = v_uid) then
    update profiles set reputation = coalesce(reputation, 0) + v_rep where id = v_uid;
  end if;
  insert into notifications (user_id, type, title, body, link)
  values (v_uid, 'incursion', 'Signalement enregistré',
          'Observation : ' || coalesce(v_title, 'une créature inconnue') || ', près de ' || v_place.name
          || case when v_rep > 0 then ' (+' || v_rep || ' de renommée).' else '.' end, null);
  if v_revealed then
    insert into notifications (user_id, type, title, body, link)
    values (v_uid, 'wiki', 'Fiche découverte',
            'Tu es le premier à voir « ' || coalesce(v_title, 'cette créature') || ' » : elle entre dans le Wiki.', null);
  end if;

  return jsonb_build_object('ok', true, 'reputation', v_rep, 'revealed', v_revealed,
                            'sightings', (select count(*) from wiki_sightings where incursion_id = v_inc.id));
end;
$$;

-- Quête de chasse (reprend 0119) : le nom d'une créature inconnue reste caché.
create or replace function incursion_hunt_quest(p_incursion uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inc map_incursions;
  w wiki_entries;
  v_name text;
  v_id uuid;
begin
  if not coalesce(has_permission(v_uid, 'manage_quests'), false) then
    raise exception 'Réservé aux responsables des quêtes.';
  end if;
  select * into v_inc from map_incursions where id = p_incursion for update;
  if v_inc.id is null or v_inc.entry_id is null or now() > v_inc.ends_at then raise exception 'Aucune créature en cours.'; end if;
  if v_inc.quest_id is not null then return v_inc.quest_id; end if;
  select * into w from wiki_entries where id = v_inc.entry_id;
  v_name := case when w.discovered then w.title else 'créature inconnue' end;

  insert into quests (title, description, reward, difficulty, deadline, status, visibility, contract_type,
                      funded_by_creator, giver, objectives, place_id, reputation_reward, created_by)
  values ('Chasse : ' || v_name,
          initcap(left(v_name, 1)) || substr(v_name, 2) || ' rôde sur la carte. Retrouve-la avant qu''elle ne reparte et signale-la depuis la Cartographie.',
          0, case when coalesce(w.rarity, 1) >= 5 then 'A' when coalesce(w.rarity, 1) >= 3 then 'B' else 'C' end,
          v_inc.ends_at, 'open', 'members', 'chasse', false, 'Le Wiki',
          array['Retrouver la créature sur la carte', 'La signaler depuis un lieu proche'],
          null, 10 + 5 * coalesce(w.rarity, 1), v_uid)
  returning id into v_id;
  update map_incursions set quest_id = v_id where id = v_inc.id;
  return v_id;
end;
$$;

-- Gestion : toutes les créatures (Mobs du Wiki) et leurs règles.
create or replace function map_creatures_admin()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  s map_settings;
begin
  if not coalesce(has_permission(auth.uid(), 'manage_map'), false) then
    raise exception 'Réservé à la gestion de la carte.';
  end if;
  select * into s from map_settings order by id limit 1;
  return jsonb_build_object(
    'deny_places', to_jsonb(coalesce(s.creature_deny_places, '{}')),
    'deny_biomes', to_jsonb(coalesce(s.creature_deny_biomes, '{}')),
    'creatures', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entry_id', w.id, 'number', w.number, 'title', w.title, 'image_url', w.image_url,
        'rarity', w.rarity, 'discovered', w.discovered,
        'custom', c.entry_id is not null,
        'enabled', coalesce(c.enabled, w.discovered),
        'weight', coalesce(c.weight, 1),
        'allow_places', to_jsonb(coalesce(c.allow_places, '{}')),
        'allow_biomes', to_jsonb(coalesce(c.allow_biomes, '{}')),
        'deny_places', to_jsonb(coalesce(c.deny_places, '{}')),
        'deny_biomes', to_jsonb(coalesce(c.deny_biomes, '{}')),
        'places_ok', (select count(*) from map_places pl where pl.is_published and _creature_place_ok(w.id, pl.id)),
        'sightings', (select count(*) from wiki_sightings ws where ws.entry_id = w.id)
      ) order by w.number)
      from wiki_entries w left join map_creatures c on c.entry_id = w.id
      where w.category = 'mobs'), '[]'::jsonb));
end;
$$;

-- Règles d'une créature. p_enabled null : revient au réglage par défaut
-- (rôde si elle est découverte) et efface ses règles.
create or replace function map_creature_set(p_entry uuid, p_enabled boolean, p_weight int,
                                            p_allow_places uuid[], p_allow_biomes uuid[],
                                            p_deny_places uuid[], p_deny_biomes uuid[])
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce(has_permission(auth.uid(), 'manage_map'), false) then
    raise exception 'Réservé à la gestion de la carte.';
  end if;
  if not exists (select 1 from wiki_entries where id = p_entry and category = 'mobs') then
    raise exception 'Créature introuvable.';
  end if;
  if p_enabled is null then
    delete from map_creatures where entry_id = p_entry;
    return;
  end if;
  if p_weight is not null and (p_weight < 1 or p_weight > 20) then raise exception 'Fréquence de 1 à 20.'; end if;
  if coalesce(p_allow_places, '{}') && coalesce(p_deny_places, '{}') then
    raise exception 'Un lieu ne peut pas être à la fois permis et interdit.';
  end if;
  if coalesce(p_allow_biomes, '{}') && coalesce(p_deny_biomes, '{}') then
    raise exception 'Un biome ne peut pas être à la fois permis et interdit.';
  end if;
  insert into map_creatures (entry_id, enabled, weight, allow_places, allow_biomes, deny_places, deny_biomes, updated_by, updated_at)
  values (p_entry, p_enabled, coalesce(p_weight, 1), coalesce(p_allow_places, '{}'), coalesce(p_allow_biomes, '{}'),
          coalesce(p_deny_places, '{}'), coalesce(p_deny_biomes, '{}'), auth.uid(), now())
  on conflict (entry_id) do update set
    enabled = excluded.enabled, weight = excluded.weight,
    allow_places = excluded.allow_places, allow_biomes = excluded.allow_biomes,
    deny_places = excluded.deny_places, deny_biomes = excluded.deny_biomes,
    updated_by = excluded.updated_by, updated_at = now();
end;
$$;

-- Lieux et biomes interdits à toutes les créatures.
create or replace function map_creatures_deny_set(p_places uuid[], p_biomes uuid[])
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce(has_permission(auth.uid(), 'manage_map'), false) then
    raise exception 'Réservé à la gestion de la carte.';
  end if;
  update map_settings set creature_deny_places = coalesce(p_places, '{}'),
                          creature_deny_biomes = coalesce(p_biomes, '{}'),
                          updated_at = now()
   where id = (select id from map_settings order by id limit 1);
end;
$$;

-- Faire apparaître une créature maintenant (remplace celle en cours).
-- p_place : lieu de départ (sinon un lieu permis au hasard).
create or replace function map_creature_spawn(p_entry uuid, p_place uuid default null, p_hours numeric default 3)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_slot bigint := floor(extract(epoch from now()) / 21600)::bigint;
  v_path jsonb;
begin
  if not coalesce(has_permission(auth.uid(), 'manage_map'), false) then
    raise exception 'Réservé à la gestion de la carte.';
  end if;
  if not exists (select 1 from wiki_entries where id = p_entry and category = 'mobs') then
    raise exception 'Créature introuvable.';
  end if;
  if p_hours is null or p_hours < 0.25 or p_hours > 72 then raise exception 'Durée de 15 minutes à 72 heures.'; end if;
  if p_place is not null and not exists (select 1 from map_places where id = p_place and is_published) then
    raise exception 'Lieu introuvable.';
  end if;
  v_path := _incursion_path(p_entry, p_place);
  if jsonb_array_length(v_path) = 0 then
    raise exception 'Aucun lieu permis pour cette créature.';
  end if;
  -- La créature en cours (ou prévue) repart.
  update map_incursions set ends_at = now()
   where ends_at > now() and entry_id is not null;
  -- Numéro de période négatif et unique : hors des périodes de 6 heures.
  insert into map_incursions (slot, entry_id, starts_at, ends_at, path, manual, set_by)
  values (-floor(extract(epoch from clock_timestamp()) * 1000)::bigint, p_entry, now(),
          now() + make_interval(secs => p_hours * 3600), v_path, true, auth.uid());
  -- La période en cours ne tire plus de créature.
  insert into map_incursions (slot, entry_id, starts_at, ends_at, path)
  values (v_slot, null, now(), now(), '[]'::jsonb)
  on conflict (slot) do nothing;
  return map_incursion_current();
end;
$$;

-- Renvoyer la créature en cours.
create or replace function map_creature_dismiss()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce(has_permission(auth.uid(), 'manage_map'), false) then
    raise exception 'Réservé à la gestion de la carte.';
  end if;
  update map_incursions set ends_at = now()
   where ends_at > now() and entry_id is not null;
  -- Pas de nouveau tirage avant la prochaine période.
  insert into map_incursions (slot, entry_id, starts_at, ends_at, path)
  values (floor(extract(epoch from now()) / 21600)::bigint, null, now(), now(), '[]'::jsonb)
  on conflict (slot) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Météo des lieux
-- ---------------------------------------------------------------------
create table if not exists map_place_weather (
  place_id uuid primary key references map_places (id) on delete cascade,
  fixed_kind text,                              -- temps qui ne change jamais
  forbidden text[] not null default '{}',       -- temps impossibles ici
  weights jsonb,                                -- {"pluie": 40, ...} ; vide : comme le biome
  updated_by uuid references profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table map_place_weather enable row level security;
drop policy if exists "map_place_weather_select" on map_place_weather;
create policy "map_place_weather_select" on map_place_weather for select using (auth.uid() is not null);

-- Pire temps des biomes qui contiennent un point (comme 0119).
create or replace function _point_biome_weather(p_x numeric, p_y numeric, p_at timestamptz,
                                                out kind text, out factor numeric, out biome_type text)
language plpgsql stable security definer set search_path = public
as $$
declare
  b record;
  k text;
  f numeric;
begin
  for b in select id, map_biomes.biome_type as t from map_biomes
            where is_published and point_in_poly(p_x, p_y, path_points) loop
    k := _biome_weather(b.id, b.t, p_at);
    f := coalesce((_weather_kinds()->k->>'factor')::numeric, 1);
    if factor is null or f > factor then
      kind := k; factor := f; biome_type := b.t;
    end if;
  end loop;
end;
$$;

-- Temps d'un lieu à un instant.
create or replace function _place_weather(p_place uuid, p_at timestamptz)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  r map_place_weather;
  p map_places;
  b record;
  v_kind text;
  v_w jsonb;
  v_total numeric;
  v_roll numeric;
  v_acc numeric := 0;
  k text;
begin
  select * into p from map_places where id = p_place;
  if p.id is null then return 'clair'; end if;
  select * into r from map_place_weather where place_id = p_place;
  if r.fixed_kind is not null then return r.fixed_kind; end if;
  select * into b from _point_biome_weather(p.x, p.y, p_at);
  v_kind := coalesce(b.kind, 'clair');
  if r.place_id is null or (r.weights is null and not v_kind = any (r.forbidden)) then
    return v_kind;
  end if;
  -- Tirage propre au lieu (le même pour tous), sans les temps interdits.
  v_w := coalesce(r.weights, _weather_weights(b.biome_type)) - r.forbidden;
  select sum(greatest(0, value::numeric)) into v_total from jsonb_each_text(v_w);
  if coalesce(v_total, 0) > 0 then
    v_roll := (('x' || substr(md5(p_place::text || ':' || _weather_slot(p_at)), 1, 8))::bit(32)::bigint)::numeric / 4294967296 * v_total;
    for k in select key from jsonb_each_text(v_w) order by key loop
      v_acc := v_acc + greatest(0, (v_w->>k)::numeric);
      if v_roll < v_acc then return k; end if;
    end loop;
  end if;
  -- Rien de possible dans le tirage : le premier temps permis.
  if not 'clair' = any (r.forbidden) then return 'clair'; end if;
  select key into k from jsonb_each(_weather_kinds()) where not key = any (r.forbidden) order by key limit 1;
  return coalesce(k, 'clair');
end;
$$;

-- Pire temps parmi des points (reprend 0119) : un point posé sur un lieu
-- qui a ses propres règles prend le temps de ce lieu.
create or replace function _points_weather(p_points jsonb, p_at timestamptz, out kind text, out factor numeric)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_on boolean;
  b record;
  pt jsonb;
  v_place uuid;
  k text;
  f numeric;
  v_x numeric;
  v_y numeric;
begin
  select coalesce(weather_enabled, true) into v_on from map_settings order by id limit 1;
  if not coalesce(v_on, true) or p_points is null then
    kind := 'clair';
    factor := 1;
    return;
  end if;
  for pt in select value from jsonb_array_elements(p_points) loop
    v_x := (pt->>'x')::numeric;
    v_y := (pt->>'y')::numeric;
    k := null;
    select w.place_id into v_place
      from map_place_weather w join map_places pl on pl.id = w.place_id
     where abs(pl.x - v_x) < 0.001 and abs(pl.y - v_y) < 0.001
     limit 1;
    if v_place is not null then
      k := _place_weather(v_place, p_at);
    else
      select * into b from _point_biome_weather(v_x, v_y, p_at);
      k := b.kind;
    end if;
    v_place := null;
    if k is null then continue; end if;
    f := coalesce((_weather_kinds()->k->>'factor')::numeric, 1);
    if factor is null or f > factor then
      kind := k;
      factor := f;
    end if;
  end loop;
  if factor is null then
    kind := 'clair';
    factor := 1;
  end if;
end;
$$;

-- Météo actuelle (reprend 0119) : biomes, et lieux qui ont leurs règles.
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
      from map_biomes b where b.is_published), '[]'::jsonb) else '[]'::jsonb end,
    'places', case when coalesce(v_on, true) then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.place_id,
        'kind', _place_weather(w.place_id, now()),
        'next', _place_weather(w.place_id, v_next + interval '1 minute'),
        'fixed_kind', w.fixed_kind, 'forbidden', to_jsonb(w.forbidden), 'weights', w.weights))
      from map_place_weather w join map_places p on p.id = w.place_id where p.is_published), '[]'::jsonb) else '[]'::jsonb end);
end;
$$;

-- Règles de météo d'un lieu (gestion de la carte). Tout vide : le lieu
-- suit son biome.
create or replace function map_place_weather_set(p_place uuid, p_fixed text, p_forbidden text[], p_weights jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  k text;
  v_total numeric := 0;
begin
  if not coalesce(has_permission(auth.uid(), 'manage_map'), false) then
    raise exception 'Réservé à la gestion de la carte.';
  end if;
  if not exists (select 1 from map_places where id = p_place) then raise exception 'Lieu introuvable.'; end if;
  p_fixed := nullif(p_fixed, '');
  p_forbidden := coalesce(p_forbidden, '{}');
  if p_weights is not null and (jsonb_typeof(p_weights) <> 'object' or p_weights = '{}'::jsonb) then p_weights := null; end if;

  if p_fixed is null and cardinality(p_forbidden) = 0 and p_weights is null then
    delete from map_place_weather where place_id = p_place;
    return;
  end if;
  if p_fixed is not null and not _weather_kinds() ? p_fixed then raise exception 'Temps inconnu : %.', p_fixed; end if;
  foreach k in array p_forbidden loop
    if not _weather_kinds() ? k then raise exception 'Temps inconnu : %.', k; end if;
  end loop;
  if p_fixed is not null and p_fixed = any (p_forbidden) then
    raise exception 'Le temps fixe ne peut pas être interdit.';
  end if;
  if (select count(*) from jsonb_object_keys(_weather_kinds()) t(key) where not key = any (p_forbidden)) = 0 then
    raise exception 'Il faut laisser au moins un temps possible.';
  end if;
  if p_weights is not null then
    for k in select key from jsonb_each(p_weights) loop
      if not _weather_kinds() ? k then raise exception 'Temps inconnu : %.', k; end if;
      if jsonb_typeof(p_weights->k) <> 'number' or (p_weights->>k)::numeric < 0 or (p_weights->>k)::numeric > 1000 then
        raise exception 'Probabilité de 0 à 1000 pour %.', k;
      end if;
      if not k = any (p_forbidden) then v_total := v_total + (p_weights->>k)::numeric; end if;
    end loop;
    if v_total <= 0 then raise exception 'Les probabilités des temps permis doivent dépasser 0.'; end if;
  end if;
  insert into map_place_weather (place_id, fixed_kind, forbidden, weights, updated_by, updated_at)
  values (p_place, p_fixed, p_forbidden, p_weights, auth.uid(), now())
  on conflict (place_id) do update set
    fixed_kind = excluded.fixed_kind, forbidden = excluded.forbidden, weights = excluded.weights,
    updated_by = excluded.updated_by, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Propriétaires
-- ---------------------------------------------------------------------
alter table map_places add column if not exists owner_id uuid references profiles (id) on delete set null;
alter table map_places add column if not exists owner_since timestamptz;
create index if not exists idx_map_places_owner on map_places (owner_id) where owner_id is not null;

-- Le propriétaire modifie les étages de son lieu-bâtiment.
drop policy if exists "building_floors_write_place_owner" on building_floors;
create policy "building_floors_write_place_owner" on building_floors for all
  to authenticated
  using (exists (select 1 from map_places p where p.id = building_floors.place_id and p.is_building and p.owner_id = auth.uid()))
  with check (exists (select 1 from map_places p where p.id = building_floors.place_id and p.is_building and p.owner_id = auth.uid()));

-- Donner (ou reprendre, p_owner vide) un lieu-bâtiment.
create or replace function map_place_owner_set(p_place uuid, p_owner uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  p map_places;
begin
  if not coalesce(has_permission(auth.uid(), 'manage_map'), false) then
    raise exception 'Réservé à la gestion de la carte.';
  end if;
  select * into p from map_places where id = p_place;
  if p.id is null then raise exception 'Lieu introuvable.'; end if;
  if not p.is_building then raise exception 'Seul un lieu-bâtiment (éditable) peut avoir un propriétaire.'; end if;
  if p_owner is not null and not exists (select 1 from profiles where id = p_owner) then
    raise exception 'Membre introuvable.';
  end if;
  update map_places set owner_id = p_owner,
                        owner_since = case when p_owner is null then null else now() end
   where id = p_place and owner_id is distinct from p_owner;
end;
$$;

-- Le propriétaire (ou la gestion) modifie la description et l'image.
create or replace function map_place_owner_edit(p_place uuid, p_description text, p_image_url text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  p map_places;
begin
  select * into p from map_places where id = p_place;
  if p.id is null then raise exception 'Lieu introuvable.'; end if;
  if not (p.owner_id = auth.uid() or coalesce(has_permission(auth.uid(), 'manage_map'), false)) then
    raise exception 'Réservé au propriétaire.';
  end if;
  if char_length(coalesce(p_description, '')) > 4000 then raise exception 'Description trop longue (4000 caractères au plus).'; end if;
  update map_places set description = nullif(btrim(p_description), ''), image_url = nullif(btrim(p_image_url), '')
   where id = p_place;
end;
$$;

-- Le nouveau propriétaire est prévenu (lieux-bâtiments et bâtiments des villes).
create or replace function _notify_new_owner()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
  v_where text;
begin
  if new.owner_id is null or new.owner_id is not distinct from (case when tg_op = 'UPDATE' then old.owner_id end) then
    return new;
  end if;
  if tg_table_name = 'map_places' then
    v_name := new.name;
    v_where := '';
  else
    v_name := coalesce(nullif(new.name, ''), 'un bâtiment');
    select ' à ' || name into v_where from map_places where id = new.city_id;
  end if;
  insert into notifications (user_id, type, title, body, link)
  values (new.owner_id, 'propriete', 'Nouvelle propriété',
          'Tu es maintenant propriétaire de ' || v_name || coalesce(v_where, '')
          || '. Tu peux en aménager l''intérieur depuis la Cartographie.', '/dashboard/map');
  return new;
exception when others then
  raise warning 'propriete: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_map_places_owner on map_places;
create trigger trg_map_places_owner after insert or update of owner_id on map_places
  for each row execute function _notify_new_owner();
drop trigger if exists trg_city_buildings_owner on city_buildings;
create trigger trg_city_buildings_owner after insert or update of owner_id on city_buildings
  for each row execute function _notify_new_owner();

-- Type de notification (ajouté à la liste existante, quelle qu'elle soit).
do $$
declare
  v_def text;
  v_list text[];
  v_new text[] := array['propriete'];
  t text;
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conname = 'notifications_type_check';
  if v_def is null then return; end if;
  v_list := string_to_array((regexp_match(v_def, '\{([^}]*)\}'))[1], ',');
  foreach t in array v_new loop
    if not t = any (v_list) then v_list := v_list || t; end if;
  end loop;
  alter table notifications drop constraint notifications_type_check;
  execute format('alter table notifications add constraint notifications_type_check check (type = any (%L::text[]))', v_list);
end $$;

-- ---------------------------------------------------------------------
-- 4. Droits
-- ---------------------------------------------------------------------
revoke execute on function _in_biomes(numeric, numeric, uuid[]) from public, anon, authenticated;
revoke execute on function _creature_place_ok(uuid, uuid) from public, anon, authenticated;
revoke execute on function _creature_pool() from public, anon, authenticated;
revoke execute on function _creature_pick() from public, anon, authenticated;
revoke execute on function _incursion_path(uuid, uuid) from public, anon, authenticated;
revoke execute on function _creature_card(uuid) from public, anon, authenticated;
revoke execute on function _place_weather(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function _point_biome_weather(numeric, numeric, timestamptz) from public, anon, authenticated;
revoke execute on function _points_weather(jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function _notify_new_owner() from public, anon, authenticated;
revoke execute on function map_incursion_current() from public, anon;
revoke execute on function incursion_sight(uuid) from public, anon;
revoke execute on function incursion_hunt_quest(uuid) from public, anon;
revoke execute on function map_creatures_admin() from public, anon;
revoke execute on function map_creature_set(uuid, boolean, int, uuid[], uuid[], uuid[], uuid[]) from public, anon;
revoke execute on function map_creatures_deny_set(uuid[], uuid[]) from public, anon;
revoke execute on function map_creature_spawn(uuid, uuid, numeric) from public, anon;
revoke execute on function map_creature_dismiss() from public, anon;
revoke execute on function map_weather_now() from public, anon;
revoke execute on function map_place_weather_set(uuid, text, text[], jsonb) from public, anon;
revoke execute on function map_place_owner_set(uuid, uuid) from public, anon;
revoke execute on function map_place_owner_edit(uuid, text, text) from public, anon;
grant execute on function map_incursion_current() to authenticated;
grant execute on function incursion_sight(uuid) to authenticated;
grant execute on function incursion_hunt_quest(uuid) to authenticated;
grant execute on function map_creatures_admin() to authenticated;
grant execute on function map_creature_set(uuid, boolean, int, uuid[], uuid[], uuid[], uuid[]) to authenticated;
grant execute on function map_creatures_deny_set(uuid[], uuid[]) to authenticated;
grant execute on function map_creature_spawn(uuid, uuid, numeric) to authenticated;
grant execute on function map_creature_dismiss() to authenticated;
grant execute on function map_weather_now() to authenticated;
grant execute on function map_place_weather_set(uuid, text, text[], jsonb) to authenticated;
grant execute on function map_place_owner_set(uuid, uuid) to authenticated;
grant execute on function map_place_owner_edit(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
