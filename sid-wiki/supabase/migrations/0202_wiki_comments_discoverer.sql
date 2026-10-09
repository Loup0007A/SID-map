-- =====================================================================
-- 0202 — Commentaires, découvreur ("Découvert par @pseudo"), liste des membres
-- À exécuter APRÈS 0200 et 0201.
-- Suppose public.profiles(id, nickname, status).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Découvreur (facultatif) : choisi par les admins dans le formulaire
-- ---------------------------------------------------------------------
alter table public.wiki_entries
  add column if not exists discovered_by uuid references public.profiles(id) on delete set null;

-- ---------------------------------------------------------------------
-- Commentaires
-- ---------------------------------------------------------------------
create table if not exists public.wiki_comments (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid not null references public.wiki_entries(id) on delete cascade,
  author_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists wiki_comments_entry_idx on public.wiki_comments (entry_id, created_at);

alter table public.wiki_comments enable row level security;

-- Accès direct réservé aux admins (modération) ; tout le reste passe par les RPC.
drop policy if exists "wiki_comments_admin_all" on public.wiki_comments;
create policy "wiki_comments_admin_all" on public.wiki_comments
  for all using (public.wiki_is_admin()) with check (public.wiki_is_admin());

-- ---------------------------------------------------------------------
-- Membres (sélecteur de découvreur) : comptes actifs uniquement
-- ---------------------------------------------------------------------
create or replace function public.wiki_members()
returns table (id uuid, nickname text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  return query
  select p.id, p.nickname
  from public.profiles p
  where p.status = 'active' and p.nickname is not null
  order by lower(p.nickname);
end;
$$;

-- ---------------------------------------------------------------------
-- wiki_get : ajoute "discoverer" (pseudo du découvreur, si la fiche est découverte)
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
    'id',         case when v_admin then v_entry.id end,
    'category',   v_entry.category,
    'number',     v_entry.number,
    'discovered', v_entry.discovered,
    'title',      case when v_entry.discovered then v_entry.title end,
    'summary',    case when v_entry.discovered then v_entry.summary end,
    'content',    case when v_entry.discovered then v_entry.content end,
    'image_url',  case when v_entry.discovered then v_entry.image_url end,
    'tags',       case when v_entry.discovered then to_jsonb(v_entry.tags) end,
    'updated_at', case when v_entry.discovered then v_entry.updated_at end,
    'discoverer', case when v_entry.discovered then v_disc end,
    'related',    v_related
  );
end;
$$;

-- ---------------------------------------------------------------------
-- RPC commentaires (uniquement sur les fiches découvertes)
-- ---------------------------------------------------------------------
create or replace function public.wiki_comments_list(p_category text, p_number int)
returns table (
  id uuid, author_id uuid, author_nickname text,
  body text, created_at timestamptz, can_delete boolean
)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_admin boolean;
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  v_admin := public.wiki_is_admin();

  return query
  select c.id, c.author_id, coalesce(p.nickname, 'Chasseur inconnu'),
         c.body, c.created_at,
         (c.author_id = auth.uid() or v_admin)
  from public.wiki_comments c
  join public.wiki_entries e on e.id = c.entry_id
  left join public.profiles p on p.id = c.author_id
  where e.category = p_category and e.number = p_number and e.discovered
  order by c.created_at asc
  limit 300;
end;
$$;

create or replace function public.wiki_comment_add(p_category text, p_number int, p_body text)
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
  if char_length(v_body) not between 1 and 2000 then
    raise exception 'Le commentaire doit faire entre 1 et 2000 caractères.';
  end if;

  select e.id into v_entry from public.wiki_entries e
  where e.category = p_category and e.number = p_number and e.discovered;
  if v_entry is null then
    raise exception 'Fiche introuvable ou non découverte.';
  end if;

  -- Anti-flood simple : 10 commentaires par minute et par membre
  if (select count(*) from public.wiki_comments c
      where c.author_id = auth.uid() and c.created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Doucement, chasseur ! Réessaie dans une minute.';
  end if;

  insert into public.wiki_comments (entry_id, author_id, body)
  values (v_entry, auth.uid(), v_body)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.wiki_comment_delete(p_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.wiki_can_read() then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  delete from public.wiki_comments c
  where c.id = p_id and (c.author_id = auth.uid() or public.wiki_is_admin());
end;
$$;

-- ---------------------------------------------------------------------
-- Droits d'exécution
-- ---------------------------------------------------------------------
revoke all on function public.wiki_members()                          from public, anon;
revoke all on function public.wiki_get(text, int)                     from public, anon;
revoke all on function public.wiki_comments_list(text, int)           from public, anon;
revoke all on function public.wiki_comment_add(text, int, text)       from public, anon;
revoke all on function public.wiki_comment_delete(uuid)               from public, anon;

grant execute on function public.wiki_members()                       to authenticated;
grant execute on function public.wiki_get(text, int)                  to authenticated;
grant execute on function public.wiki_comments_list(text, int)        to authenticated;
grant execute on function public.wiki_comment_add(text, int, text)    to authenticated;
grant execute on function public.wiki_comment_delete(uuid)            to authenticated;
