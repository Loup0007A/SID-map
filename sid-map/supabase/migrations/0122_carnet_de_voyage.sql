-- =====================================================================
-- 0122 — Carnet de voyage (Lot 97)
-- À lancer après 0121. Peut être relancée sans risque.
--
-- Chaque arrivée dans un lieu est notée dans le carnet du membre (étape :
-- lieu, lieu de départ, heure). Le membre peut écrire une note sur chaque
-- lieu. Le carnet n'est lisible que par son auteur.
--
-- carnet() : chiffres (lieux parcourus, découvertes, distance parcourue),
-- étapes (les 200 dernières), lieux parcourus (date de première visite,
-- note). Les étapes commencent avec cette migration ; les lieux parcourus
-- avant viennent de l'exploration (Lot 88).
-- =====================================================================

create table if not exists public.carnet_etapes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid not null references public.map_places (id) on delete cascade,
  depuis_id uuid references public.map_places (id) on delete set null,
  arrivee_at timestamptz not null default now()
);
create index if not exists carnet_etapes_user_idx on public.carnet_etapes (user_id, arrivee_at desc);
alter table public.carnet_etapes enable row level security;
drop policy if exists carnet_etapes_select_own on public.carnet_etapes;
create policy carnet_etapes_select_own on public.carnet_etapes for select to authenticated using (user_id = auth.uid());
revoke all on public.carnet_etapes from anon;
revoke insert, update, delete on public.carnet_etapes from authenticated;

create table if not exists public.carnet_notes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  place_id uuid not null references public.map_places (id) on delete cascade,
  note text not null check (char_length(note) between 1 and 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
alter table public.carnet_notes enable row level security;
drop policy if exists carnet_notes_own on public.carnet_notes;
create policy carnet_notes_own on public.carnet_notes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.carnet_notes from anon;

-- Arrivée dans un lieu : une étape (pas deux de suite au même endroit).
create or replace function public._carnet_on_position()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_last uuid;
begin
  if new.place_id is null then return null; end if;
  if tg_op = 'UPDATE' and new.place_id is not distinct from old.place_id then return null; end if;
  select e.place_id into v_last from public.carnet_etapes e
  where e.user_id = new.user_id order by e.arrivee_at desc, e.id desc limit 1;
  if v_last is not distinct from new.place_id then return null; end if;
  insert into public.carnet_etapes (user_id, place_id, depuis_id)
  values (new.user_id, new.place_id, coalesce(case when tg_op = 'UPDATE' then old.place_id end, v_last));
  return null;
exception when others then
  -- Le carnet ne doit jamais bloquer un déplacement.
  return null;
end;
$$;
revoke execute on function public._carnet_on_position() from public, anon, authenticated;

drop trigger if exists trg_carnet_on_position on public.character_positions;
create trigger trg_carnet_on_position after insert or update of place_id on public.character_positions
  for each row execute function public._carnet_on_position();

create or replace function public.carnet()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  return jsonb_build_object(
    'chiffres', jsonb_build_object(
      'lieux', (select count(*) from public.exploration_visits v join public.map_places m on m.id = v.place_id
                where v.user_id = v_uid and m.is_published),
      'lieux_total', (select count(*) from public.map_places m where m.is_published and m.discovered_at is not null),
      'decouvertes', (select count(*) from public.map_places m where m.discovered_by = v_uid and m.is_published),
      'etapes', (select count(*) from public.carnet_etapes e where e.user_id = v_uid),
      'km', coalesce((select round(t.value) from public.title_progress t where t.user_id = v_uid and t.key = 'travel_km'), 0),
      'depuis', (select min(e.arrivee_at) from public.carnet_etapes e where e.user_id = v_uid)),
    'etapes', coalesce((
      select jsonb_agg(jsonb_build_object('id', e.id, 'date', e.arrivee_at,
               'lieu', jsonb_build_object('id', m.id, 'name', m.name, 'type', m.type),
               'depuis', case when d.id is not null then jsonb_build_object('id', d.id, 'name', d.name) end)
             order by e.arrivee_at desc, e.id desc)
      from (select * from public.carnet_etapes e where e.user_id = v_uid order by e.arrivee_at desc, e.id desc limit 200) e
      join public.map_places m on m.id = e.place_id
      left join public.map_places d on d.id = e.depuis_id), '[]'),
    'lieux', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name, 'type', m.type, 'premiere', v.first_at,
               'decouvert_par_moi', coalesce(m.discovered_by = v_uid, false),
               'passages', (select count(*) from public.carnet_etapes e where e.user_id = v_uid and e.place_id = m.id),
               'note', n.note, 'note_at', n.updated_at)
             order by v.first_at desc)
      from public.exploration_visits v
      join public.map_places m on m.id = v.place_id and m.is_published
      left join public.carnet_notes n on n.user_id = v_uid and n.place_id = m.id
      where v.user_id = v_uid), '[]'));
end;
$$;
revoke execute on function public.carnet() from public, anon;
grant execute on function public.carnet() to authenticated;
