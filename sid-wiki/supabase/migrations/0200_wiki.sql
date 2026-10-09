-- =====================================================================
-- 0200_wiki.sql — Wiki S.I.D. (lieux, armes, mobs, objets)
-- À exécuter dans le SQL Editor du projet Supabase partagé
-- (après les migrations 0001 → 0006 et 0100 → 0104).
--
-- Principe : les visiteurs n'ont AUCUN accès direct aux tables.
-- Ils passent par des fonctions RPC (security definer) qui masquent
-- tout ce qui n'est pas "découvert" (titre, texte, image, tags = null).
-- Les administrateurs (permission `manage_wiki`, ou Fondateur) lisent
-- et écrivent directement dans les tables via les policies RLS.
-- =====================================================================

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.wiki_entries (
  id            uuid primary key default gen_random_uuid(),
  category      text not null check (category in ('lieux', 'armes', 'mobs', 'objets')),
  number        int  not null check (number between 0 and 999),
  title         text not null,
  summary       text not null default '',
  content       text not null default '',          -- markdown
  image_url     text,
  tags          text[] not null default '{}',
  discovered    boolean not null default false,
  discovered_at timestamptz,
  created_by    uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (category, number)
);

create index if not exists wiki_entries_category_idx on public.wiki_entries (category, number);
create index if not exists wiki_entries_tags_idx on public.wiki_entries using gin (tags);

-- Liens entre fiches ("Voir aussi"), traités comme non orientés à l'affichage.
create table if not exists public.wiki_entry_links (
  from_id uuid not null references public.wiki_entries(id) on delete cascade,
  to_id   uuid not null references public.wiki_entries(id) on delete cascade,
  primary key (from_id, to_id),
  check (from_id <> to_id)
);

create index if not exists wiki_entry_links_to_idx on public.wiki_entry_links (to_id);

-- ---------------------------------------------------------------------
-- Trigger : updated_at / discovered_at
-- ---------------------------------------------------------------------
create or replace function public.wiki_entries_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    if new.discovered then
      new.discovered_at := now();
    end if;
  else
    if new.discovered and not old.discovered then
      new.discovered_at := now();
    elsif not new.discovered then
      new.discovered_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists wiki_entries_touch on public.wiki_entries;
create trigger wiki_entries_touch
  before insert or update on public.wiki_entries
  for each row execute function public.wiki_entries_touch();

-- ---------------------------------------------------------------------
-- Helpers de permission
-- ---------------------------------------------------------------------
create or replace function public.wiki_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.has_permission(auth.uid(), 'manage_wiki'), false);
$$;

-- Lecture du wiki : compte actif (même règle que la Cartographie) ou admin.
create or replace function public.wiki_can_read()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and (
       public.wiki_is_admin()
       or exists (
         select 1 from public.profiles p
         where p.id = auth.uid() and p.status = 'active'
       )
     );
$$;

create or replace function public.wiki_like_escape(p_text text)
returns text
language sql
immutable
as $$
  select replace(replace(replace(p_text, '\', '\\'), '%', '\%'), '_', '\_');
$$;

-- ---------------------------------------------------------------------
-- RLS : accès direct réservé aux admins
-- ---------------------------------------------------------------------
alter table public.wiki_entries enable row level security;
alter table public.wiki_entry_links enable row level security;

drop policy if exists "wiki_entries_admin_all" on public.wiki_entries;
create policy "wiki_entries_admin_all" on public.wiki_entries
  for all
  using (public.wiki_is_admin())
  with check (public.wiki_is_admin());

drop policy if exists "wiki_entry_links_admin_all" on public.wiki_entry_links;
create policy "wiki_entry_links_admin_all" on public.wiki_entry_links
  for all
  using (public.wiki_is_admin())
  with check (public.wiki_is_admin());

-- ---------------------------------------------------------------------
-- RPC de lecture (masquage des fiches non découvertes)
-- ---------------------------------------------------------------------

-- Liste d'une catégorie. Non découvert => title/summary/image/tags à null.
-- Les admins voient tout (le champ `discovered` permet d'afficher un badge).
create or replace function public.wiki_list(p_category text)
returns table (
  category   text,
  number     int,
  discovered boolean,
  title      text,
  summary    text,
  image_url  text,
  tags       text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean;
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_admin := public.wiki_is_admin();

  return query
  select
    e.category,
    e.number,
    e.discovered,
    case when e.discovered or v_admin then e.title end,
    case when e.discovered or v_admin then e.summary end,
    case when e.discovered or v_admin then e.image_url end,
    case when e.discovered or v_admin then e.tags end
  from public.wiki_entries e
  where e.category = p_category
  order by e.number;
end;
$$;

-- Une fiche complète + fiches liées.
create or replace function public.wiki_get(p_category text, p_number int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin   boolean;
  v_entry   public.wiki_entries;
  v_show    boolean;
  v_related jsonb;
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_admin := public.wiki_is_admin();

  select * into v_entry
  from public.wiki_entries e
  where e.category = p_category and e.number = p_number;

  if not found then
    return null;
  end if;

  v_show := v_entry.discovered or v_admin;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'category',   r.category,
        'number',     r.number,
        'discovered', r.discovered,
        'title',      case when r.discovered or v_admin then r.title end
      )
      order by r.category, r.number
    ),
    '[]'::jsonb
  )
  into v_related
  from public.wiki_entries r
  where r.id in (
    select l.to_id from public.wiki_entry_links l where l.from_id = v_entry.id
    union
    select l.from_id from public.wiki_entry_links l where l.to_id = v_entry.id
  );

  return jsonb_build_object(
    'id',            case when v_admin then v_entry.id end,
    'category',      v_entry.category,
    'number',        v_entry.number,
    'discovered',    v_entry.discovered,
    'title',         case when v_show then v_entry.title end,
    'summary',       case when v_show then v_entry.summary end,
    'content',       case when v_show then v_entry.content end,
    'image_url',     case when v_show then v_entry.image_url end,
    'tags',          case when v_show then to_jsonb(v_entry.tags) end,
    'updated_at',    case when v_show then v_entry.updated_at end,
    'related',       v_related
  );
end;
$$;

-- Aperçu léger (survol d'un lien) : ne renvoie jamais le contenu.
create or replace function public.wiki_preview(p_category text, p_number int)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean;
  v_entry public.wiki_entries;
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_admin := public.wiki_is_admin();

  select * into v_entry
  from public.wiki_entries e
  where e.category = p_category and e.number = p_number;

  if not found then
    return jsonb_build_object('exists', false);
  end if;

  if v_entry.discovered or v_admin then
    return jsonb_build_object(
      'exists',     true,
      'discovered', v_entry.discovered,
      'title',      v_entry.title,
      'summary',    v_entry.summary,
      'image_url',  v_entry.image_url
    );
  end if;

  return jsonb_build_object('exists', true, 'discovered', false);
end;
$$;

-- Recherche plein texte (sans accents, multi-mots, insensible à la casse).
-- Les fiches non découvertes ne sont jamais renvoyées aux non-admins.
create or replace function public.wiki_search(p_query text, p_limit int default 30)
returns table (
  category   text,
  number     int,
  discovered boolean,
  title      text,
  summary    text,
  image_url  text,
  tags       text[]
)
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  v_admin boolean;
  v_q     text;
  v_words text[];
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_admin := public.wiki_is_admin();

  v_q := unaccent(lower(btrim(translate(coalesce(p_query, ''), '/', ' '))));
  if v_q = '' then
    return;
  end if;

  v_words := array(
    select public.wiki_like_escape(w)
    from unnest(regexp_split_to_array(v_q, '\s+')) as w
    where w <> ''
  );

  return query
  select e.category, e.number, e.discovered, e.title, e.summary, e.image_url, e.tags
  from public.wiki_entries e
  where (e.discovered or v_admin)
    and not exists (
      select 1
      from unnest(v_words) as w
      where not (
        unaccent(lower(
          e.title || ' ' || e.summary || ' ' || e.content || ' ' ||
          array_to_string(e.tags, ' ') || ' ' ||
          e.category || ' ' || lpad(e.number::text, 3, '0')
        )) like '%' || w || '%' escape '\'
      )
    )
  order by
    (unaccent(lower(e.title)) like '%' || public.wiki_like_escape(v_q) || '%' escape '\') desc,
    e.category,
    e.number
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$$;

-- Tags visibles d'une catégorie (uniquement ceux des fiches découvertes).
create or replace function public.wiki_tags(p_category text)
returns setof text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_admin boolean;
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_admin := public.wiki_is_admin();

  return query
  select distinct t
  from public.wiki_entries e, unnest(e.tags) as t
  where e.category = p_category
    and (e.discovered or v_admin)
  order by t;
end;
$$;

-- Compteurs pour l'accueil : "12 / 48 découverts".
create or replace function public.wiki_stats()
returns table (category text, total int, discovered_count int)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  return query
  select
    e.category,
    count(*)::int,
    (count(*) filter (where e.discovered))::int
  from public.wiki_entries e
  group by e.category;
end;
$$;

-- Plus petit numéro libre d'une catégorie (admin).
create or replace function public.wiki_next_number(p_category text)
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_next int;
begin
  if not public.wiki_is_admin() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  select g into v_next
  from generate_series(0, 999) as g
  where not exists (
    select 1 from public.wiki_entries e
    where e.category = p_category and e.number = g
  )
  order by g
  limit 1;

  return v_next;
end;
$$;

-- ---------------------------------------------------------------------
-- Droits d'exécution : utilisateurs connectés uniquement
-- ---------------------------------------------------------------------
revoke all on function public.wiki_is_admin()                    from public, anon;
revoke all on function public.wiki_can_read()                    from public, anon;
revoke all on function public.wiki_list(text)                    from public, anon;
revoke all on function public.wiki_get(text, int)                from public, anon;
revoke all on function public.wiki_preview(text, int)            from public, anon;
revoke all on function public.wiki_search(text, int)             from public, anon;
revoke all on function public.wiki_tags(text)                    from public, anon;
revoke all on function public.wiki_stats()                       from public, anon;
revoke all on function public.wiki_next_number(text)             from public, anon;

grant execute on function public.wiki_is_admin()                 to authenticated;
grant execute on function public.wiki_can_read()                 to authenticated;
grant execute on function public.wiki_list(text)                 to authenticated;
grant execute on function public.wiki_get(text, int)             to authenticated;
grant execute on function public.wiki_preview(text, int)         to authenticated;
grant execute on function public.wiki_search(text, int)          to authenticated;
grant execute on function public.wiki_tags(text)                 to authenticated;
grant execute on function public.wiki_stats()                    to authenticated;
grant execute on function public.wiki_next_number(text)          to authenticated;

-- ---------------------------------------------------------------------
-- Storage : bucket public pour les images des fiches, écriture admin
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('wiki-images', 'wiki-images', true)
on conflict (id) do nothing;

drop policy if exists "wiki_images_read" on storage.objects;
create policy "wiki_images_read" on storage.objects
  for select using (bucket_id = 'wiki-images');

drop policy if exists "wiki_images_admin_insert" on storage.objects;
create policy "wiki_images_admin_insert" on storage.objects
  for insert with check (bucket_id = 'wiki-images' and public.wiki_is_admin());

drop policy if exists "wiki_images_admin_update" on storage.objects;
create policy "wiki_images_admin_update" on storage.objects
  for update using (bucket_id = 'wiki-images' and public.wiki_is_admin());

drop policy if exists "wiki_images_admin_delete" on storage.objects;
create policy "wiki_images_admin_delete" on storage.objects
  for delete using (bucket_id = 'wiki-images' and public.wiki_is_admin());

-- ---------------------------------------------------------------------
-- Donner la permission `manage_wiki` à un rôle (le Fondateur l'a déjà).
-- ADAPTE les noms de colonnes à ta table role_permissions, puis décommente :
--
-- insert into public.role_permissions (role_id, permission)
-- select r.id, 'manage_wiki'
-- from public.roles r
-- where r.name = 'État-Major'
-- on conflict do nothing;
-- ---------------------------------------------------------------------
