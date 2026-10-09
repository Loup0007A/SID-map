-- =====================================================================
-- 0203 — Catégorie "skills", modèles 3D animés, fiche technique (infobox),
--         rareté ★, favoris, historique des versions, découvertes récentes,
--         classement des découvreurs, fiche au hasard.
-- À exécuter APRÈS 0200, 0201 et 0202.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Catégorie "skills" + nouvelles colonnes
-- ---------------------------------------------------------------------
alter table public.wiki_entries drop constraint if exists wiki_entries_category_check;
alter table public.wiki_entries
  add constraint wiki_entries_category_check
  check (category in ('lieux', 'armes', 'mobs', 'objets', 'skills'));

alter table public.wiki_entries
  add column if not exists rarity smallint check (rarity between 1 and 8),
  add column if not exists infobox jsonb not null default '[]'::jsonb,
  add column if not exists model_url text,
  add column if not exists model_animation text;

-- ---------------------------------------------------------------------
-- 2. Bucket des modèles 3D (.glb) — lecture publique, écriture admin
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('wiki-models', 'wiki-models', true, 52428800)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "wiki_models_read" on storage.objects;
create policy "wiki_models_read" on storage.objects
  for select using (bucket_id = 'wiki-models');

drop policy if exists "wiki_models_admin_insert" on storage.objects;
create policy "wiki_models_admin_insert" on storage.objects
  for insert with check (bucket_id = 'wiki-models' and public.wiki_is_admin());

drop policy if exists "wiki_models_admin_update" on storage.objects;
create policy "wiki_models_admin_update" on storage.objects
  for update using (bucket_id = 'wiki-models' and public.wiki_is_admin());

drop policy if exists "wiki_models_admin_delete" on storage.objects;
create policy "wiki_models_admin_delete" on storage.objects
  for delete using (bucket_id = 'wiki-models' and public.wiki_is_admin());

-- ---------------------------------------------------------------------
-- 3. Favoris (⭐ personnels) — accès uniquement via RPC
-- ---------------------------------------------------------------------
create table if not exists public.wiki_favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  entry_id   uuid not null references public.wiki_entries(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);
alter table public.wiki_favorites enable row level security;  -- aucune policy : RPC uniquement

-- ---------------------------------------------------------------------
-- 4. Historique des versions (admin) : snapshot AVANT chaque modification
-- ---------------------------------------------------------------------
create table if not exists public.wiki_revisions (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.wiki_entries(id) on delete cascade,
  title      text not null,
  summary    text not null,
  content    text not null,
  tags       text[] not null,
  infobox    jsonb not null,
  edited_by  uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists wiki_revisions_entry_idx on public.wiki_revisions (entry_id, created_at desc);

alter table public.wiki_revisions enable row level security;
drop policy if exists "wiki_revisions_admin_select" on public.wiki_revisions;
create policy "wiki_revisions_admin_select" on public.wiki_revisions
  for select using (public.wiki_is_admin());

create or replace function public.wiki_entries_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.title, old.summary, old.content, old.tags, old.infobox)
     is distinct from (new.title, new.summary, new.content, new.tags, new.infobox) then
    insert into public.wiki_revisions (entry_id, title, summary, content, tags, infobox, edited_by)
    values (old.id, old.title, old.summary, old.content, old.tags, old.infobox, auth.uid());

    -- On garde les 50 dernières versions par fiche.
    delete from public.wiki_revisions r
    where r.entry_id = old.id
      and r.id not in (
        select r2.id from public.wiki_revisions r2
        where r2.entry_id = old.id
        order by r2.created_at desc
        limit 50
      );
  end if;
  return new;
end;
$$;

drop trigger if exists wiki_entries_snapshot on public.wiki_entries;
create trigger wiki_entries_snapshot
  before update on public.wiki_entries
  for each row execute function public.wiki_entries_snapshot();

-- ---------------------------------------------------------------------
-- 5. Listes : on recrée wiki_list / wiki_search avec rareté + indicateur 3D
-- ---------------------------------------------------------------------
drop function if exists public.wiki_list(text);
drop function if exists public.wiki_search(text, int);

create function public.wiki_list(p_category text)
returns table (
  category text, number int, discovered boolean,
  title text, summary text, image_url text, tags text[],
  rarity smallint, has_model boolean
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  return query
  select e.category, e.number, e.discovered,
    case when e.discovered then e.title end,
    case when e.discovered then e.summary end,
    case when e.discovered then e.image_url end,
    case when e.discovered then e.tags end,
    case when e.discovered then e.rarity end,
    (e.discovered and e.model_url is not null)
  from public.wiki_entries e
  where e.category = p_category
  order by e.number;
end;
$$;

create function public.wiki_search(p_query text, p_limit int default 30)
returns table (
  category text, number int, discovered boolean,
  title text, summary text, image_url text, tags text[],
  rarity smallint, has_model boolean
)
language plpgsql stable security definer set search_path = public, extensions
as $$
declare
  v_q     text;
  v_words text[];
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  v_q := unaccent(lower(btrim(translate(coalesce(p_query, ''), '/', ' '))));
  if v_q = '' then return; end if;

  v_words := array(
    select public.wiki_like_escape(w)
    from unnest(regexp_split_to_array(v_q, '\s+')) as w
    where w <> ''
  );

  return query
  select e.category, e.number, e.discovered, e.title, e.summary, e.image_url, e.tags,
         e.rarity, (e.model_url is not null)
  from public.wiki_entries e
  where e.discovered
    and not exists (
      select 1 from unnest(v_words) as w
      where not (
        unaccent(lower(
          e.title || ' ' || e.summary || ' ' || e.content || ' ' ||
          array_to_string(e.tags, ' ') || ' ' ||
          e.infobox::text || ' ' ||
          e.category || ' ' || lpad(e.number::text, 3, '0')
        )) like '%' || w || '%' escape '\'
      )
    )
  order by
    (unaccent(lower(e.title)) like '%' || public.wiki_like_escape(v_q) || '%' escape '\') desc,
    e.category, e.number
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. wiki_get : + fiche technique, rareté, modèle 3D, favori, voisins
-- ---------------------------------------------------------------------
create or replace function public.wiki_get(p_category text, p_number int)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_admin   boolean;
  v_entry   public.wiki_entries;
  v_related jsonb;
  v_disc    text;
  v_prev    int;
  v_next    int;
  v_fav     boolean;
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_admin := public.wiki_is_admin();

  select * into v_entry from public.wiki_entries e
  where e.category = p_category and e.number = p_number;
  if not found then return null; end if;

  if v_entry.discovered and v_entry.discovered_by is not null then
    select p.nickname into v_disc from public.profiles p where p.id = v_entry.discovered_by;
  end if;

  select e.number into v_prev from public.wiki_entries e
   where e.category = p_category and e.number < p_number order by e.number desc limit 1;
  select e.number into v_next from public.wiki_entries e
   where e.category = p_category and e.number > p_number order by e.number asc limit 1;

  v_fav := exists (
    select 1 from public.wiki_favorites f
    where f.user_id = auth.uid() and f.entry_id = v_entry.id
  );

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'category', r.category, 'number', r.number, 'discovered', r.discovered,
      'title', case when r.discovered then r.title end
    ) order by r.category, r.number), '[]'::jsonb)
  into v_related
  from public.wiki_entries r
  where r.id in (
    select l.to_id from public.wiki_entry_links l where l.from_id = v_entry.id
    union
    select l.from_id from public.wiki_entry_links l where l.to_id = v_entry.id
  );

  return jsonb_build_object(
    'id',              case when v_admin then v_entry.id end,
    'category',        v_entry.category,
    'number',          v_entry.number,
    'discovered',      v_entry.discovered,
    'title',           case when v_entry.discovered then v_entry.title end,
    'summary',         case when v_entry.discovered then v_entry.summary end,
    'content',         case when v_entry.discovered then v_entry.content end,
    'image_url',       case when v_entry.discovered then v_entry.image_url end,
    'tags',            case when v_entry.discovered then to_jsonb(v_entry.tags) end,
    'updated_at',      case when v_entry.discovered then v_entry.updated_at end,
    'discoverer',      case when v_entry.discovered then v_disc end,
    'infobox',         case when v_entry.discovered then v_entry.infobox end,
    'rarity',          case when v_entry.discovered then v_entry.rarity end,
    'model_url',       case when v_entry.discovered then v_entry.model_url end,
    'model_animation', case when v_entry.discovered then v_entry.model_animation end,
    'favorited',       v_fav,
    'prev',            v_prev,
    'next',            v_next,
    'related',         v_related
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Favoris
-- ---------------------------------------------------------------------
create or replace function public.wiki_favorite_toggle(p_category text, p_number int)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_entry uuid;
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  select e.id into v_entry from public.wiki_entries e
  where e.category = p_category and e.number = p_number and e.discovered;
  if v_entry is null then
    raise exception 'Fiche introuvable ou non découverte.';
  end if;

  if exists (select 1 from public.wiki_favorites f where f.user_id = auth.uid() and f.entry_id = v_entry) then
    delete from public.wiki_favorites f where f.user_id = auth.uid() and f.entry_id = v_entry;
    return false;
  end if;

  insert into public.wiki_favorites (user_id, entry_id) values (auth.uid(), v_entry);
  return true;
end;
$$;

create or replace function public.wiki_favorites_list()
returns table (
  category text, number int, discovered boolean,
  title text, summary text, image_url text, tags text[],
  rarity smallint, has_model boolean
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  return query
  select e.category, e.number, e.discovered, e.title, e.summary, e.image_url, e.tags,
         e.rarity, (e.model_url is not null)
  from public.wiki_favorites f
  join public.wiki_entries e on e.id = f.entry_id
  where f.user_id = auth.uid() and e.discovered
  order by f.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Accueil : découvertes récentes, classement, fiche au hasard
-- ---------------------------------------------------------------------
create or replace function public.wiki_recent(p_limit int default 6)
returns table (
  category text, number int, title text, image_url text,
  discovered_at timestamptz, discoverer text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  return query
  select e.category, e.number, e.title, e.image_url, e.discovered_at, p.nickname
  from public.wiki_entries e
  left join public.profiles p on p.id = e.discovered_by
  where e.discovered
  order by e.discovered_at desc nulls last, e.updated_at desc
  limit least(greatest(coalesce(p_limit, 6), 1), 30);
end;
$$;

create or replace function public.wiki_top_discoverers(p_limit int default 5)
returns table (nickname text, total bigint)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  return query
  select p.nickname, count(*)::bigint
  from public.wiki_entries e
  join public.profiles p on p.id = e.discovered_by
  where e.discovered and p.nickname is not null
  group by p.nickname
  order by count(*) desc, p.nickname
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
end;
$$;

create or replace function public.wiki_random()
returns table (category text, number int)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  return query
  select e.category, e.number
  from public.wiki_entries e
  where e.discovered
  order by random()
  limit 1;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Droits d'exécution
-- ---------------------------------------------------------------------
revoke all on function public.wiki_list(text)                      from public, anon;
revoke all on function public.wiki_search(text, int)               from public, anon;
revoke all on function public.wiki_get(text, int)                  from public, anon;
revoke all on function public.wiki_favorite_toggle(text, int)      from public, anon;
revoke all on function public.wiki_favorites_list()                from public, anon;
revoke all on function public.wiki_recent(int)                     from public, anon;
revoke all on function public.wiki_top_discoverers(int)            from public, anon;
revoke all on function public.wiki_random()                        from public, anon;

grant execute on function public.wiki_list(text)                   to authenticated;
grant execute on function public.wiki_search(text, int)            to authenticated;
grant execute on function public.wiki_get(text, int)               to authenticated;
grant execute on function public.wiki_favorite_toggle(text, int)   to authenticated;
grant execute on function public.wiki_favorites_list()            to authenticated;
grant execute on function public.wiki_recent(int)                  to authenticated;
grant execute on function public.wiki_top_discoverers(int)         to authenticated;
grant execute on function public.wiki_random()                     to authenticated;
