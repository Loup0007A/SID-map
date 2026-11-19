-- =====================================================================
-- 0118 — Brouillard d'exploration
-- À lancer après 0117 (et après les migrations du Wiki, 0200 et suivantes).
-- Peut être relancée sans risque.
--
-- * Un membre ne voit de la carte que ce que son personnage a parcouru :
--   les lieux où il est passé, les routes qu'il a suivies, et les lieux
--   voisins (reliés par une route) affichés comme « inexplorés ».
--   Les membres qui gèrent la carte (manage_map) voient tout.
-- * Le premier membre à atteindre un lieu nouveau en devient le découvreur.
--   Les lieux qui existaient avant cette migration sont considérés comme
--   déjà découverts (sans découvreur).
-- * Une fiche du Wiki peut être liée à des lieux (wiki_entry_places) : si
--   elle n'est pas encore découverte, le premier membre qui atteint un de
--   ces lieux la découvre pour tout le monde.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Réglages
-- ---------------------------------------------------------------------
alter table map_settings add column if not exists fog_enabled boolean not null default true;
-- Rayon dévoilé autour d'un lieu visité (unités de la carte) ; vide : 9 % de la taille du monde.
alter table map_settings add column if not exists fog_radius numeric check (fog_radius is null or fog_radius > 0);

-- ---------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------
create table if not exists exploration_visits (
  user_id uuid not null references profiles (id) on delete cascade,
  place_id uuid not null references map_places (id) on delete cascade,
  first_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
create index if not exists exploration_visits_place_idx on exploration_visits (place_id, first_at);
alter table exploration_visits enable row level security;
drop policy if exists "exploration_visits_select" on exploration_visits;
create policy "exploration_visits_select" on exploration_visits for select using (user_id = auth.uid());

create table if not exists exploration_routes (
  user_id uuid not null references profiles (id) on delete cascade,
  route_id uuid not null references map_routes (id) on delete cascade,
  first_at timestamptz not null default now(),
  primary key (user_id, route_id)
);
alter table exploration_routes enable row level security;
drop policy if exists "exploration_routes_select" on exploration_routes;
create policy "exploration_routes_select" on exploration_routes for select using (user_id = auth.uid());

do $$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'map_places' and column_name = 'discovered_at') then
    alter table map_places add column discovered_at timestamptz;
    alter table map_places add column discovered_by uuid references profiles (id) on delete set null;
    -- Les lieux déjà là sont connus de tous.
    update map_places set discovered_at = created_at where discovered_at is null;
  end if;
end $$;

-- Fiches du Wiki liées à des lieux de la carte.
create table if not exists wiki_entry_places (
  entry_id uuid not null references wiki_entries (id) on delete cascade,
  place_id uuid not null references map_places (id) on delete cascade,
  primary key (entry_id, place_id)
);
create index if not exists wiki_entry_places_place_idx on wiki_entry_places (place_id);
alter table wiki_entry_places enable row level security;
drop policy if exists "wiki_entry_places_select" on wiki_entry_places;
create policy "wiki_entry_places_select" on wiki_entry_places for select using (auth.uid() is not null);
drop policy if exists "wiki_entry_places_admin" on wiki_entry_places;
create policy "wiki_entry_places_admin" on wiki_entry_places for all
  using (public.wiki_is_admin()) with check (public.wiki_is_admin());

-- Les positions actuelles comptent comme visitées (sans découverte).
insert into exploration_visits (user_id, place_id, first_at)
select user_id, place_id, coalesce(arrived_at, updated_at, now())
from character_positions where place_id is not null
on conflict do nothing;

-- Types de notification (ajoutés à la liste existante, quelle qu'elle soit).
do $$
declare
  v_def text;
  v_list text[];
  v_new text[] := array['exploration', 'incursion', 'wiki'];
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
-- 3. Découverte et enregistrement des visites
-- ---------------------------------------------------------------------
create or replace function _exploration_discover(p_uid uuid, p_place uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
  v_nick text;
  e record;
begin
  -- Les comptes de test ne découvrent rien.
  if exists (select 1 from sandbox_accounts where user_id = p_uid) then return; end if;
  select nickname into v_nick from profiles where id = p_uid;

  update map_places set discovered_at = now(), discovered_by = p_uid
   where id = p_place and discovered_at is null and is_published
  returning name into v_name;
  if v_name is not null then
    insert into notifications (user_id, type, title, body, link)
    values (p_uid, 'exploration', 'Lieu découvert', 'Tu es le premier à atteindre ' || v_name || '.', '/dashboard/map');
  end if;

  for e in
    update wiki_entries w set discovered = true, discovered_at = now(), discovered_by = p_uid
     where w.discovered = false
       and w.id in (select entry_id from wiki_entry_places where place_id = p_place)
    returning w.category, w.number, w.title
  loop
    insert into notifications (user_id, type, title, body, link)
    values (p_uid, 'wiki', 'Fiche découverte',
            'Ton passage révèle « ' || coalesce(e.title, 'une fiche') || ' » dans le Wiki.',
            null);
  end loop;
exception when others then
  -- Une découverte ratée ne doit jamais bloquer un trajet.
  raise warning 'exploration: %', sqlerrm;
end;
$$;

create or replace function _exploration_on_position()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_n int;
begin
  if new.place_id is null then return null; end if;
  if tg_op = 'UPDATE' and new.place_id is not distinct from old.place_id then return null; end if;
  if tg_op = 'UPDATE' and old.route_id is not null then
    insert into exploration_routes (user_id, route_id) values (new.user_id, old.route_id) on conflict do nothing;
  end if;
  insert into exploration_visits (user_id, place_id) values (new.user_id, new.place_id) on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n > 0 then perform _exploration_discover(new.user_id, new.place_id); end if;
  return null;
end;
$$;
drop trigger if exists trg_exploration_on_position on character_positions;
create trigger trg_exploration_on_position
  after insert or update of place_id on character_positions
  for each row execute function _exploration_on_position();

-- ---------------------------------------------------------------------
-- 4. Lecture
-- ---------------------------------------------------------------------
-- État de l'exploration du membre connecté.
create or replace function exploration_state()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  s map_settings;
  v_visited uuid[];
begin
  if v_uid is null then return null; end if;
  select * into s from map_settings order by id limit 1;
  select coalesce(array_agg(v.place_id), '{}') into v_visited
    from exploration_visits v join map_places p on p.id = v.place_id
   where v.user_id = v_uid and p.is_published;

  return jsonb_build_object(
    'enabled', coalesce(s.fog_enabled, true),
    'bypass', coalesce(has_permission(v_uid, 'manage_map'), false),
    'radius', coalesce(s.fog_radius, coalesce(s.world_size, 100) * 0.09),
    'visited', to_jsonb(v_visited),
    'routes', coalesce((select jsonb_agg(route_id) from exploration_routes where user_id = v_uid), '[]'::jsonb),
    'frontier', coalesce((
      select jsonb_agg(distinct x.pid) from (
        select case when r.from_place_id = any (v_visited) then r.to_place_id else r.from_place_id end as pid
        from map_routes r
        where r.is_published and (r.from_place_id = any (v_visited) or r.to_place_id = any (v_visited))
      ) x where not x.pid = any (v_visited)), '[]'::jsonb),
    'total', (select count(*) from map_places where is_published),
    'explored', cardinality(v_visited),
    'zones', coalesce((
      select jsonb_agg(jsonb_build_object('id', z.id, 'name', z.name, 'total', z.total, 'visited', z.visited) order by z.name)
      from (
        select zz.id, zz.name, count(p.id) as total, count(p.id) filter (where p.id = any (v_visited)) as visited
        from map_zones zz join map_places p on p.zone_id = zz.id and p.is_published
        where zz.is_published
        group by zz.id, zz.name
      ) z), '[]'::jsonb),
    'discoverers', coalesce((
      select jsonb_object_agg(p.id, jsonb_build_object('nickname', pr.nickname, 'at', p.discovered_at))
      from map_places p join profiles pr on pr.id = p.discovered_by
      where p.id = any (v_visited)), '{}'::jsonb)
  );
end;
$$;

-- Meilleurs explorateurs (lieux visités, comptes actifs et visibles).
create or replace function exploration_leaderboard(p_limit int default 10)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(x order by x.places desc, x.first_seen), '[]'::jsonb)
  from (
    select pr.nickname, count(*) as places, min(v.first_at) as first_seen,
           (select count(*) from map_places p2 where p2.discovered_by = v.user_id) as discovered,
           v.user_id = auth.uid() as me
    from exploration_visits v
    join map_places p on p.id = v.place_id and p.is_published
    join profiles pr on pr.id = v.user_id and pr.status = 'active'
    where auth.uid() is not null
      and not exists (select 1 from sandbox_accounts sb where sb.user_id = v.user_id)
      and not coalesce(pr.is_invisible, false)
    group by v.user_id, pr.nickname
    order by count(*) desc
    limit greatest(1, least(50, coalesce(p_limit, 10)))
  ) x;
$$;

-- Fiches du Wiki liées à un lieu (pour la fiche du lieu sur la carte).
create or replace function place_wiki_entries(p_place uuid)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'category', w.category, 'number', w.number, 'discovered', w.discovered,
           'title', case when w.discovered then w.title end,
           'image_url', case when w.discovered then w.image_url end)
         order by w.category, w.number), '[]'::jsonb)
  from wiki_entry_places l join wiki_entries w on w.id = l.entry_id
  where l.place_id = p_place and auth.uid() is not null;
$$;

-- ---------------------------------------------------------------------
-- 5. Réglage (gestion de la carte)
-- ---------------------------------------------------------------------
create or replace function map_fog_set(p_enabled boolean, p_radius numeric default null)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not coalesce(has_permission(auth.uid(), 'manage_map'), false) then
    raise exception 'Réservé à la gestion de la carte.';
  end if;
  if p_radius is not null and p_radius <= 0 then raise exception 'Le rayon doit être positif.'; end if;
  update map_settings set fog_enabled = coalesce(p_enabled, fog_enabled), fog_radius = p_radius, updated_at = now()
   where id = (select id from map_settings order by id limit 1);
end;
$$;

revoke execute on function _exploration_discover(uuid, uuid) from public, anon, authenticated;
revoke execute on function _exploration_on_position() from public, anon, authenticated;
revoke execute on function exploration_state() from public, anon;
revoke execute on function exploration_leaderboard(int) from public, anon;
revoke execute on function place_wiki_entries(uuid) from public, anon;
revoke execute on function map_fog_set(boolean, numeric) from public, anon;
grant execute on function exploration_state() to authenticated;
grant execute on function exploration_leaderboard(int) to authenticated;
grant execute on function place_wiki_entries(uuid) to authenticated;
grant execute on function map_fog_set(boolean, numeric) to authenticated;
