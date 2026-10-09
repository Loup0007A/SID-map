-- =====================================================================
-- 0205 — Grosse mise à jour : notes personnelles, signalements, annonce d'accueil,
--         page des tags, vue d'ensemble admin (fiches à compléter), duplication.
-- À exécuter APRÈS 0200 … 0204. Suppose public.profiles(id, nickname, status).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Notes personnelles (privées : seul l'auteur les voit) — RPC uniquement
-- ---------------------------------------------------------------------
create table if not exists public.wiki_notes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  entry_id   uuid not null references public.wiki_entries(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 5000),
  updated_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);
alter table public.wiki_notes enable row level security;  -- aucune policy : RPC uniquement

create or replace function public.wiki_note_get(p_category text, p_number int)
returns text
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return (
    select n.body from public.wiki_notes n
    join public.wiki_entries e on e.id = n.entry_id
    where n.user_id = auth.uid() and e.category = p_category and e.number = p_number and e.discovered
  );
end;
$$;

-- Texte vide = suppression de la note
create or replace function public.wiki_note_set(p_category text, p_number int, p_body text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_entry uuid;
  v_body  text := btrim(coalesce(p_body, ''));
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if char_length(v_body) > 5000 then
    raise exception 'Note trop longue (5000 caractères maximum).';
  end if;

  select e.id into v_entry from public.wiki_entries e
  where e.category = p_category and e.number = p_number and e.discovered;
  if v_entry is null then
    raise exception 'Fiche introuvable ou non découverte.';
  end if;

  if v_body = '' then
    delete from public.wiki_notes where user_id = auth.uid() and entry_id = v_entry;
  else
    insert into public.wiki_notes (user_id, entry_id, body)
    values (auth.uid(), v_entry, v_body)
    on conflict (user_id, entry_id) do update set body = excluded.body, updated_at = now();
  end if;
end;
$$;

create or replace function public.wiki_notes_list()
returns table (category text, number int, title text, body text, updated_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return query
  select e.category, e.number, e.title, n.body, n.updated_at
  from public.wiki_notes n
  join public.wiki_entries e on e.id = n.entry_id
  where n.user_id = auth.uid() and e.discovered
  order by n.updated_at desc;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Signalements (erreur, info manquante, idée) — boîte de réception admin
-- ---------------------------------------------------------------------
create table if not exists public.wiki_reports (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.wiki_entries(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('erreur', 'manque', 'idee', 'autre')),
  body        text not null check (char_length(btrim(body)) between 3 and 1000),
  status      text not null default 'open' check (status in ('open', 'done')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists wiki_reports_status_idx on public.wiki_reports (status, created_at desc);
alter table public.wiki_reports enable row level security;

drop policy if exists "wiki_reports_admin_all" on public.wiki_reports;
create policy "wiki_reports_admin_all" on public.wiki_reports
  for all using (public.wiki_is_admin()) with check (public.wiki_is_admin());

create or replace function public.wiki_report_add(p_category text, p_number int, p_kind text, p_body text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_entry uuid;
  v_id    uuid;
  v_body  text := btrim(coalesce(p_body, ''));
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if p_kind not in ('erreur', 'manque', 'idee', 'autre') then
    raise exception 'Type de signalement invalide.';
  end if;
  if char_length(v_body) not between 3 and 1000 then
    raise exception 'Le message doit faire entre 3 et 1000 caractères.';
  end if;

  select e.id into v_entry from public.wiki_entries e
  where e.category = p_category and e.number = p_number and e.discovered;
  if v_entry is null then
    raise exception 'Fiche introuvable ou non découverte.';
  end if;

  -- Anti-flood : 5 signalements par 10 minutes et par membre
  if (select count(*) from public.wiki_reports r
      where r.author_id = auth.uid() and r.created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'Doucement, chasseur ! Réessaie dans quelques minutes.';
  end if;

  insert into public.wiki_reports (entry_id, author_id, kind, body)
  values (v_entry, auth.uid(), p_kind, v_body)
  returning id into v_id;
  return v_id;
end;
$$;

-- Liste pour les admins (ouverts d'abord)
create or replace function public.wiki_reports_list()
returns table (
  id uuid, category text, number int, title text, kind text, body text,
  status text, author text, created_at timestamptz, resolved_at timestamptz
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.wiki_is_admin() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return query
  select r.id, e.category, e.number, e.title, r.kind, r.body, r.status,
         coalesce(p.nickname, 'inconnu'), r.created_at, r.resolved_at
  from public.wiki_reports r
  join public.wiki_entries e on e.id = r.entry_id
  left join public.profiles p on p.id = r.author_id
  order by (r.status = 'open') desc, r.created_at desc
  limit 300;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Annonce d'accueil (bannière modifiable par les admins)
-- ---------------------------------------------------------------------
create table if not exists public.wiki_settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.wiki_settings enable row level security;  -- aucune policy : RPC uniquement

create or replace function public.wiki_announcement_get()
returns text
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return (select s.value from public.wiki_settings s where s.key = 'announcement');
end;
$$;

create or replace function public.wiki_announcement_set(p_text text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.wiki_is_admin() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if char_length(coalesce(p_text, '')) > 500 then
    raise exception 'Annonce trop longue (500 caractères maximum).';
  end if;
  insert into public.wiki_settings (key, value) values ('announcement', btrim(coalesce(p_text, '')))
  on conflict (key) do update set value = excluded.value, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Page des tags : uniquement les fiches découvertes
-- ---------------------------------------------------------------------
create or replace function public.wiki_all_tags()
returns table (category text, tag text, total int)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return query
  select e.category, t.tag, count(*)::int
  from public.wiki_entries e
  cross join lateral unnest(e.tags) as t(tag)
  where e.discovered
  group by e.category, t.tag
  order by count(*) desc, t.tag;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Admin : vue d'ensemble d'une catégorie (qualité + popularité)
-- ---------------------------------------------------------------------
create or replace function public.wiki_admin_overview(p_category text)
returns table (
  id uuid, has_summary boolean, has_content boolean, has_image boolean,
  has_discoverer boolean, has_infobox boolean,
  comments int, favorites int, open_reports int
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.wiki_is_admin() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  return query
  select e.id,
         btrim(e.summary) <> '',
         btrim(e.content) <> '',
         e.image_url is not null,
         e.discovered_by is not null,
         jsonb_array_length(e.infobox) > 0,
         (select count(*)::int from public.wiki_comments c where c.entry_id = e.id),
         (select count(*)::int from public.wiki_favorites f where f.entry_id = e.id),
         (select count(*)::int from public.wiki_reports r where r.entry_id = e.id and r.status = 'open')
  from public.wiki_entries e
  where e.category = p_category;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Admin : dupliquer une fiche (copie masquée, au prochain numéro libre ;
--    sans image ni modèle 3D pour ne pas partager de fichier du stockage)
-- ---------------------------------------------------------------------
create or replace function public.wiki_entry_duplicate(p_id uuid)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_src  public.wiki_entries%rowtype;
  v_next int;
begin
  if not public.wiki_is_admin() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  select * into v_src from public.wiki_entries where id = p_id;
  if not found then
    raise exception 'Fiche introuvable.';
  end if;

  select g into v_next
  from generate_series(0, 999) as g
  where not exists (
    select 1 from public.wiki_entries e where e.category = v_src.category and e.number = g
  )
  order by g limit 1;
  if v_next is null then
    raise exception 'Cette catégorie est pleine (000–999).';
  end if;

  insert into public.wiki_entries (category, number, title, summary, content, tags, infobox, rarity, discovered, created_by)
  values (v_src.category, v_next, left(v_src.title || ' (copie)', 200), v_src.summary, v_src.content,
          v_src.tags, v_src.infobox, v_src.rarity, false, auth.uid());
  return v_next;
end;
$$;

-- ---------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------
revoke all on function public.wiki_note_get(text, int)                  from public, anon;
revoke all on function public.wiki_note_set(text, int, text)            from public, anon;
revoke all on function public.wiki_notes_list()                         from public, anon;
revoke all on function public.wiki_report_add(text, int, text, text)    from public, anon;
revoke all on function public.wiki_reports_list()                       from public, anon;
revoke all on function public.wiki_announcement_get()                   from public, anon;
revoke all on function public.wiki_announcement_set(text)               from public, anon;
revoke all on function public.wiki_all_tags()                           from public, anon;
revoke all on function public.wiki_admin_overview(text)                 from public, anon;
revoke all on function public.wiki_entry_duplicate(uuid)                from public, anon;

grant execute on function public.wiki_note_get(text, int)               to authenticated;
grant execute on function public.wiki_note_set(text, int, text)         to authenticated;
grant execute on function public.wiki_notes_list()                      to authenticated;
grant execute on function public.wiki_report_add(text, int, text, text) to authenticated;
grant execute on function public.wiki_reports_list()                    to authenticated;
grant execute on function public.wiki_announcement_get()                to authenticated;
grant execute on function public.wiki_announcement_set(text)            to authenticated;
grant execute on function public.wiki_all_tags()                        to authenticated;
grant execute on function public.wiki_admin_overview(text)              to authenticated;
grant execute on function public.wiki_entry_duplicate(uuid)             to authenticated;
