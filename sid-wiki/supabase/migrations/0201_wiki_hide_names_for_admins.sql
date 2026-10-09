-- =====================================================================
-- 0201 — Une fiche non découverte est TOUJOURS anonyme ("?") sur le wiki,
-- même pour les admins (titre, résumé, image, tags, contenu = null).
-- Les admins gèrent le contenu caché depuis le Dashboard (accès direct aux tables).
-- À exécuter APRÈS 0200_wiki.sql.
-- =====================================================================

create or replace function public.wiki_list(p_category text)
returns table (
  category text, number int, discovered boolean,
  title text, summary text, image_url text, tags text[]
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
    case when e.discovered then e.tags end
  from public.wiki_entries e
  where e.category = p_category
  order by e.number;
end;
$$;

create or replace function public.wiki_get(p_category text, p_number int)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_admin   boolean;
  v_entry   public.wiki_entries;
  v_related jsonb;
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_admin := public.wiki_is_admin();

  select * into v_entry from public.wiki_entries e
  where e.category = p_category and e.number = p_number;
  if not found then return null; end if;

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
    'id',         case when v_admin then v_entry.id end,   -- sert uniquement au bouton "Modifier"
    'category',   v_entry.category,
    'number',     v_entry.number,
    'discovered', v_entry.discovered,
    'title',      case when v_entry.discovered then v_entry.title end,
    'summary',    case when v_entry.discovered then v_entry.summary end,
    'content',    case when v_entry.discovered then v_entry.content end,
    'image_url',  case when v_entry.discovered then v_entry.image_url end,
    'tags',       case when v_entry.discovered then to_jsonb(v_entry.tags) end,
    'updated_at', case when v_entry.discovered then v_entry.updated_at end,
    'related',    v_related
  );
end;
$$;

create or replace function public.wiki_preview(p_category text, p_number int)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_entry public.wiki_entries;
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  select * into v_entry from public.wiki_entries e
  where e.category = p_category and e.number = p_number;
  if not found then return jsonb_build_object('exists', false); end if;

  if v_entry.discovered then
    return jsonb_build_object(
      'exists', true, 'discovered', true,
      'title', v_entry.title, 'summary', v_entry.summary, 'image_url', v_entry.image_url
    );
  end if;
  return jsonb_build_object('exists', true, 'discovered', false);
end;
$$;

create or replace function public.wiki_search(p_query text, p_limit int default 30)
returns table (
  category text, number int, discovered boolean,
  title text, summary text, image_url text, tags text[]
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
  select e.category, e.number, e.discovered, e.title, e.summary, e.image_url, e.tags
  from public.wiki_entries e
  where e.discovered
    and not exists (
      select 1 from unnest(v_words) as w
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
    e.category, e.number
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
end;
$$;

create or replace function public.wiki_tags(p_category text)
returns setof text
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  return query
  select distinct t
  from public.wiki_entries e, unnest(e.tags) as t
  where e.category = p_category and e.discovered
  order by t;
end;
$$;
