-- =====================================================================
-- 0106 : quêtes terminées masquées, marchés noirs (10 % aux admins),
-- cristaux de téléportation. 100 % additif.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Quêtes terminées : on ne les affiche plus et on ne les revalide plus.
-- ⚠ Les valeurs exactes de quests.status sur le site principal sont
-- inconnues : ajuste la liste ci-dessous si besoin.
-- ---------------------------------------------------------------------
create or replace function quest_is_finished(p_status text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_status, '')) in (
    'validated','validee','validée','valide','validé',
    'completed','complete','complétée','completee','terminee','terminée','termine','terminé',
    'done','finished','closed','cloturee','clôturée','archived','archivee','archivée',
    'cancelled','canceled','annulee','annulée','expired','expiree','expirée',
    'failed','echouee','échouée'
  );
$$;

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
     where place_id is not null
       and not quest_is_finished(status::text)',
    coalesce(quote_ident(title_col), 'id::text')
  ) into result;

  return result;
end;
$$;

create or replace function check_quest_arrival()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_pos record;
  v_quest record;
  v_elapsed_min numeric;
  v_result jsonb := '[]'::jsonb;
begin
  select * into v_pos from character_positions where user_id = auth.uid();
  if not found or v_pos.place_id is null or v_pos.arrived_at is null
     or v_pos.travel_started_at is not null then
    return v_result;
  end if;

  v_elapsed_min := extract(epoch from (now() - v_pos.arrived_at)) / 60;
  if v_elapsed_min < 60 then
    return v_result;
  end if;

  for v_quest in
    select q.id
    from quests q
    join quest_participants qp on qp.quest_id = q.id and qp.user_id = auth.uid()
    where q.place_id = v_pos.place_id
      and not quest_is_finished(q.status::text)
  loop
    begin
      perform validate_quest_participant(v_quest.id, auth.uid());
      v_result := v_result || jsonb_build_object('quest_id', v_quest.id, 'validated', true);
    exception when others then
      v_result := v_result || jsonb_build_object('quest_id', v_quest.id, 'validated', false, 'error', sqlerrm);
    end;
  end loop;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Marchés noirs
-- ---------------------------------------------------------------------
alter table map_places add column if not exists allows_black_market boolean not null default false;

create table if not exists black_market_stalls (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references map_places(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (owner_id, place_id)
);

create table if not exists black_market_items (
  id uuid primary key default gen_random_uuid(),
  stall_id uuid not null references black_market_stalls(id) on delete cascade,
  name text not null,
  description text,
  price numeric not null check (price > 0),
  stock integer check (stock is null or stock >= 0), -- null = illimité
  created_at timestamptz not null default now()
);

create table if not exists black_market_sales (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references black_market_items(id) on delete set null,
  stall_id uuid references black_market_stalls(id) on delete set null,
  buyer_id uuid not null,
  seller_id uuid not null,
  item_name text not null,
  quantity integer not null,
  total_price numeric not null,
  admin_fee numeric not null,
  created_at timestamptz not null default now()
);

alter table black_market_stalls enable row level security;
alter table black_market_items enable row level security;
alter table black_market_sales enable row level security;

-- Étals : lecture pour tous les connectés
drop policy if exists bm_stalls_read on black_market_stalls;
create policy bm_stalls_read on black_market_stalls for select to authenticated using (true);

-- Création : lieu autorisé + présence physique (hors voyage)
drop policy if exists bm_stalls_insert on black_market_stalls;
create policy bm_stalls_insert on black_market_stalls for insert to authenticated
with check (
  owner_id = auth.uid()
  and exists (select 1 from map_places p where p.id = place_id and p.allows_black_market)
  and exists (
    select 1 from character_positions cp
    where cp.user_id = auth.uid() and cp.place_id = black_market_stalls.place_id
      and cp.travel_started_at is null
  )
);

drop policy if exists bm_stalls_update on black_market_stalls;
create policy bm_stalls_update on black_market_stalls for update to authenticated
using (owner_id = auth.uid() or has_permission(auth.uid(), 'manage_map'))
with check (owner_id = auth.uid() or has_permission(auth.uid(), 'manage_map'));

drop policy if exists bm_stalls_delete on black_market_stalls;
create policy bm_stalls_delete on black_market_stalls for delete to authenticated
using (owner_id = auth.uid() or has_permission(auth.uid(), 'manage_map'));

-- Articles
drop policy if exists bm_items_read on black_market_items;
create policy bm_items_read on black_market_items for select to authenticated using (true);

drop policy if exists bm_items_write on black_market_items;
create policy bm_items_write on black_market_items for all to authenticated
using (
  exists (select 1 from black_market_stalls s where s.id = stall_id
          and (s.owner_id = auth.uid() or has_permission(auth.uid(), 'manage_map')))
)
with check (
  exists (select 1 from black_market_stalls s where s.id = stall_id
          and (s.owner_id = auth.uid() or has_permission(auth.uid(), 'manage_map')))
);

-- Ventes : lecture acheteur / vendeur / admins, aucune écriture directe
drop policy if exists bm_sales_read on black_market_sales;
create policy bm_sales_read on black_market_sales for select to authenticated
using (buyer_id = auth.uid() or seller_id = auth.uid() or has_permission(auth.uid(), 'manage_map'));

-- Achat : 10 % de commission répartis entre les admins
create or replace function buy_black_market_item(p_item_id uuid, p_quantity int default 1)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_item record;
  v_stall record;
  v_pos record;
  v_balance numeric;
  v_total numeric;
  v_fee numeric;
  v_admin_count int;
  v_each numeric;
  v_given numeric := 0;
  v_admin record;
begin
  if p_quantity is null or p_quantity < 1 then
    return jsonb_build_object('error', 'invalid_quantity');
  end if;

  select * into v_item from black_market_items where id = p_item_id for update;
  if not found then return jsonb_build_object('error', 'item_not_found'); end if;

  select * into v_stall from black_market_stalls where id = v_item.stall_id;
  if not found or not v_stall.is_active then return jsonb_build_object('error', 'stall_closed'); end if;
  if v_stall.owner_id = auth.uid() then return jsonb_build_object('error', 'own_stall'); end if;

  if v_item.stock is not null and v_item.stock < p_quantity then
    return jsonb_build_object('error', 'out_of_stock');
  end if;

  select * into v_pos from character_positions where user_id = auth.uid();
  if not found or v_pos.place_id is distinct from v_stall.place_id then
    return jsonb_build_object('error', 'not_at_location');
  end if;
  if v_pos.travel_started_at is not null then
    return jsonb_build_object('error', 'currently_traveling');
  end if;

  v_total := round(v_item.price * p_quantity, 2);
  v_fee := round(v_total * 0.10, 2);

  select balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_total then
    return jsonb_build_object('error', 'insufficient_funds');
  end if;

  update wallets set balance = balance - v_total where user_id = auth.uid();
  update wallets set balance = balance + (v_total - v_fee) where user_id = v_stall.owner_id;

  select count(*) into v_admin_count
  from profiles
  where (is_founder or has_permission(id, 'manage_map'))
    and id <> v_stall.owner_id and id <> auth.uid();

  if v_admin_count > 0 and v_fee > 0 then
    v_each := round(v_fee / v_admin_count, 2);
    for v_admin in
      select id from profiles
      where (is_founder or has_permission(id, 'manage_map'))
        and id <> v_stall.owner_id and id <> auth.uid()
    loop
      update wallets set balance = balance + v_each where user_id = v_admin.id;
      v_given := v_given + v_each;
    end loop;
  end if;
  -- (le reliquat d'arrondi / commission sans admin disponible sort de la circulation)

  if v_item.stock is not null then
    update black_market_items set stock = stock - p_quantity where id = v_item.id;
  end if;

  insert into black_market_sales (item_id, stall_id, buyer_id, seller_id, item_name, quantity, total_price, admin_fee)
  values (v_item.id, v_stall.id, auth.uid(), v_stall.owner_id, v_item.name, p_quantity, v_total, v_fee);

  return jsonb_build_object('success', true, 'total', v_total, 'admin_fee', v_fee);
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Cristaux de téléportation
-- ---------------------------------------------------------------------
create table if not exists teleport_crystals (
  id uuid primary key default gen_random_uuid(),
  label text not null default 'Cristal de téléportation',
  from_place_id uuid not null references map_places(id) on delete cascade,
  to_place_id uuid not null references map_places(id) on delete cascade,
  holder_id uuid not null references profiles(id) on delete cascade,
  is_single_use boolean not null default true,
  used_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_place_id <> to_place_id)
);

alter table teleport_crystals enable row level security;

drop policy if exists crystals_read on teleport_crystals;
create policy crystals_read on teleport_crystals for select to authenticated
using (holder_id = auth.uid() or has_permission(auth.uid(), 'manage_map'));

drop policy if exists crystals_admin_write on teleport_crystals;
create policy crystals_admin_write on teleport_crystals for all to authenticated
using (has_permission(auth.uid(), 'manage_map'))
with check (has_permission(auth.uid(), 'manage_map'));

create or replace function use_teleport_crystal(p_crystal_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_c record;
  v_pos record;
begin
  select * into v_c from teleport_crystals where id = p_crystal_id for update;
  if not found or v_c.holder_id <> auth.uid() then
    return jsonb_build_object('error', 'crystal_not_found');
  end if;
  if v_c.is_single_use and v_c.used_at is not null then
    return jsonb_build_object('error', 'already_used');
  end if;

  select * into v_pos from character_positions where user_id = auth.uid();
  if not found or v_pos.place_id is distinct from v_c.from_place_id then
    return jsonb_build_object('error', 'wrong_place');
  end if;
  if v_pos.travel_started_at is not null then
    return jsonb_build_object('error', 'currently_traveling');
  end if;

  update character_positions set
    place_id = v_c.to_place_id,
    building_id = null,
    route_id = null,
    flight_target_place_id = null,
    travel_started_at = null,
    travel_duration_minutes = null,
    arrived_at = now(),
    updated_at = now()
  where user_id = auth.uid();

  if v_c.is_single_use then
    update teleport_crystals set used_at = now() where id = v_c.id;
  end if;

  return jsonb_build_object('success', true, 'to_place_id', v_c.to_place_id);
end;
$$;
