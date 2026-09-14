-- =====================================================================
-- 0104_territory_and_quests.sql
-- Additif : rattache la carte à deux systèmes déjà existants sur le
-- site principal : les groupes/factions (contrôle territorial) et les
-- quêtes (localisation d'une mission sur la carte). Rien d'existant
-- n'est supprimé ni modifié.
--
-- Important : les deux fonctions ci-dessous sont volontairement EN
-- SECURITY INVOKER (pas definer) : elles s'exécutent avec les droits
-- de la personne qui les appelle, donc respectent exactement les RLS
-- déjà en place sur `groups` et `quests` sur le site principal. Elles
-- ne contournent aucune règle de confidentialité existante.
-- =====================================================================

alter table map_zones
  add column if not exists controlling_group_id uuid references groups(id) on delete set null;
alter table map_places
  add column if not exists controlling_group_id uuid references groups(id) on delete set null;

alter table quests
  add column if not exists place_id uuid references map_places(id) on delete set null;

create index if not exists idx_quests_place on quests(place_id);

-- ---------------------------------------------------------------------
-- Liste des groupes avec un libellé lisible, quelle que soit la
-- colonne réellement utilisée pour le nom (détection automatique via
-- information_schema, pour ne pas deviner au hasard).
-- ---------------------------------------------------------------------
create or replace function list_groups_for_map()
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  result jsonb;
  name_col text;
begin
  select column_name into name_col
  from information_schema.columns
  where table_schema = 'public' and table_name = 'groups'
    and column_name in ('name', 'label', 'title', 'nom')
  order by array_position(array['name','label','title','nom'], column_name)
  limit 1;

  if name_col is null then
    select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', id::text)), '[]'::jsonb)
      into result from groups;
  else
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''id'', id, ''label'', %I)), ''[]''::jsonb) from groups',
      name_col
    ) into result;
  end if;

  return result;
end;
$$;

-- ---------------------------------------------------------------------
-- Missions ouvertes localisées sur la carte (place_id renseigné),
-- même détection automatique pour la colonne "titre".
-- ---------------------------------------------------------------------
create or replace function list_map_quests()
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  result jsonb;
  title_col text;
begin
  select column_name into title_col
  from information_schema.columns
  where table_schema = 'public' and table_name = 'quests'
    and column_name in ('title', 'name', 'titre', 'nom')
  order by array_position(array['title','name','titre','nom'], column_name)
  limit 1;

  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(
        ''id'', id, ''title'', %s, ''place_id'', place_id,
        ''status'', status, ''contract_type'', contract_type,
        ''reward'', reward, ''visibility'', visibility
      )), ''[]''::jsonb)
     from quests
     where place_id is not null',
    coalesce(quote_ident(title_col), 'id::text')
  ) into result;

  return result;
end;
$$;
