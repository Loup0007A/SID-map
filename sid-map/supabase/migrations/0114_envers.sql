-- =====================================================================
-- 0114 : L'Envers. Additif, peut être relancée sans risque.
--
-- Quelque part sur la carte, à un endroit choisi par l'administration (ou
-- tiré au hasard), la feuille est fragile : qui clique cinq fois de suite
-- au même endroit la déchire et passe de l'autre côté, dans L'Envers.
--
--   * Le Chemin sans fin : tant qu'on y reste, on avance tout seul, deux
--     fois plus vite que sa propre allure (marche, ou monture louée), et la
--     distance s'ajoute à ce qu'on a parcouru. Un séjour dure 12 h au plus ;
--     partir en voyage (ou se téléporter) y met fin.
--   * Le Comptoir de l'Envers : un petit marché noir tenu par
--     l'administration. L'argent des ventes est partagé entre les admins.
--
-- Rien n'est visible tant qu'on n'a pas trouvé la faille : l'endroit n'est
-- lisible que par l'administration, et les sondages sont limités (pas plus
-- d'un toutes les 2 s ni de 20 par heure).
--
-- Administration : /carte?envers=1 (réservé aux admins de la carte).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Réglages (une seule ligne, illisible directement).
-- ---------------------------------------------------------------------
create table if not exists envers_config (
  id int primary key default 1 check (id = 1),
  x numeric not null,
  y numeric not null,
  radius numeric not null default 1.5 check (radius > 0),        -- tolérance du clic (unités de carte)
  km_multiplier numeric not null default 2 check (km_multiplier > 0),
  session_hours numeric not null default 12 check (session_hours > 0),
  access_minutes numeric not null default 60 check (access_minutes > 0), -- accès au Comptoir après la déchirure
  probe_gap_seconds numeric not null default 2,
  probes_per_hour int not null default 20,
  is_open boolean not null default true,
  moved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into envers_config (id, x, y)
select 1,
       round((8 + random() * (greatest(coalesce((select world_size from map_settings where id = 1), 100), 100) - 16))::numeric, 2),
       round((8 + random() * (greatest(coalesce((select world_size from map_settings where id = 1), 100), 100) - 16))::numeric, 2)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Séjours (un par membre) et Comptoir.
-- ---------------------------------------------------------------------
create table if not exists envers_stays (
  user_id uuid primary key references profiles(id) on delete cascade,
  inside boolean not null default false,
  entered_at timestamptz,
  last_tick_at timestamptz,
  ends_at timestamptz,
  speed_kmh numeric not null default 0,
  session_km numeric not null default 0,
  km_total numeric not null default 0,       -- tout ce qui a été parcouru dans L'Envers
  first_found_at timestamptz,
  last_found_at timestamptz,
  found_count int not null default 0,
  last_probe_at timestamptz,
  probe_window_start timestamptz,
  probe_window_count int not null default 0
);

create table if not exists envers_items (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  price numeric not null check (price > 0),
  stock int check (stock is null or stock >= 0),   -- null = illimité
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists envers_sales (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references envers_items(id) on delete set null,
  buyer_id uuid not null references profiles(id) on delete cascade,
  item_name text not null,
  quantity int not null,
  total_price numeric not null,
  created_at timestamptz not null default now()
);

-- Aucune lecture directe : tout passe par les fonctions ci-dessous.
alter table envers_config enable row level security;
alter table envers_stays enable row level security;
alter table envers_items enable row level security;
alter table envers_sales enable row level security;

-- ---------------------------------------------------------------------
-- 3. Petits outils.
-- ---------------------------------------------------------------------
create or replace function _envers_is_admin(p_uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_founder from profiles where id = p_uid), false)
      or coalesce(has_permission(p_uid, 'manage_map'), false);
$$;

-- Allure du membre (km/h) : sa monture louée si elle court encore, sinon
-- la marche ; multipliée par le bonus de L'Envers.
create or replace function _envers_speed(p_uid uuid)
returns numeric
language plpgsql stable security definer set search_path = public
as $$
declare
  v_walk numeric := coalesce((select walk_kmh from map_settings where id = 1), 5);
  v_mult numeric := coalesce((select km_multiplier from envers_config where id = 1), 2);
  v_mount numeric := 1;
begin
  select coalesce(m.speed_multiplier, 1) into v_mount
  from character_positions cp
  join mount_types m on m.id = cp.active_mount_id
  where cp.user_id = p_uid
    and (cp.mount_expires_at is null or cp.mount_expires_at > now());
  return round(v_walk * coalesce(v_mount, 1) * v_mult, 3);
end;
$$;

-- Fait avancer le séjour jusqu'à maintenant (ou jusqu'à sa fin).
create or replace function _envers_tick(p_uid uuid, p_close boolean default false)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  s envers_stays;
  v_until timestamptz;
  v_km numeric;
begin
  select * into s from envers_stays where user_id = p_uid for update;
  if not found or not s.inside then return; end if;

  v_until := least(now(), coalesce(s.ends_at, now()));
  v_km := greatest(0, extract(epoch from (v_until - s.last_tick_at)) / 3600.0) * s.speed_kmh;

  update envers_stays
     set session_km = session_km + v_km,
         km_total = km_total + v_km,
         last_tick_at = v_until,
         inside = not (p_close or v_until >= ends_at)
   where user_id = p_uid;
end;
$$;

-- L'accès au Comptoir : admin, ou séjour en cours, ou faille ouverte
-- il y a peu.
create or replace function _envers_has_access(p_uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select _envers_is_admin(p_uid)
      or exists (
        select 1 from envers_stays s, envers_config c
        where s.user_id = p_uid and c.id = 1 and c.is_open
          and (s.inside or s.last_found_at > now() - (c.access_minutes || ' minutes')::interval)
      );
$$;

revoke execute on function _envers_is_admin(uuid) from public, anon, authenticated;
revoke execute on function _envers_speed(uuid) from public, anon, authenticated;
revoke execute on function _envers_tick(uuid, boolean) from public, anon, authenticated;
revoke execute on function _envers_has_access(uuid) from public, anon, authenticated;

-- Partir en voyage ou se téléporter fait sortir de L'Envers.
create or replace function trg_envers_leave_on_move()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (new.travel_started_at is not null and old.travel_started_at is null)
     or (new.place_id is distinct from old.place_id) then
    if exists (select 1 from envers_stays where user_id = new.user_id and inside) then
      perform _envers_tick(new.user_id, true);
    end if;
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_envers_leave_on_move on character_positions;
create trigger trg_envers_leave_on_move
  after update on character_positions
  for each row execute function trg_envers_leave_on_move();

-- ---------------------------------------------------------------------
-- 4. Sonder la carte (5 clics au même endroit, côté navigateur).
-- Ne renvoie que « trouvé » ou rien, jamais de piste.
-- ---------------------------------------------------------------------
create or replace function envers_probe(p_x numeric, p_y numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  c envers_config;
  s envers_stays;
  v_uid uuid := auth.uid();
begin
  if v_uid is null or p_x is null or p_y is null then return jsonb_build_object('ok', false); end if;
  select * into c from envers_config where id = 1;
  if not found or not c.is_open then return jsonb_build_object('ok', false); end if;

  insert into envers_stays (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into s from envers_stays where user_id = v_uid for update;

  -- Limites : pas de balayage de la carte.
  if s.last_probe_at is not null and s.last_probe_at > now() - (c.probe_gap_seconds || ' seconds')::interval then
    return jsonb_build_object('ok', false);
  end if;
  if s.probe_window_start is null or s.probe_window_start < now() - interval '1 hour' then
    s.probe_window_start := now();
    s.probe_window_count := 0;
  end if;
  if s.probe_window_count >= c.probes_per_hour then
    update envers_stays set last_probe_at = now() where user_id = v_uid;
    return jsonb_build_object('ok', false);
  end if;

  update envers_stays
     set last_probe_at = now(),
         probe_window_start = s.probe_window_start,
         probe_window_count = s.probe_window_count + 1
   where user_id = v_uid;

  if sqrt(power(p_x - c.x, 2) + power(p_y - c.y, 2)) > c.radius then
    return jsonb_build_object('ok', false);
  end if;

  update envers_stays
     set first_found_at = coalesce(first_found_at, now()),
         last_found_at = now(),
         found_count = found_count + 1,
         probe_window_count = greatest(0, probe_window_count - 1) -- une réussite ne compte pas
   where user_id = v_uid;

  return jsonb_build_object('ok', true, 'first', s.first_found_at is null);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. État de L'Envers pour le membre.
-- ---------------------------------------------------------------------
create or replace function envers_state()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  s envers_stays;
  c envers_config;
  v_admin boolean;
  v_pos record;
begin
  if v_uid is null then return jsonb_build_object('access', false); end if;
  perform _envers_tick(v_uid);
  if not _envers_has_access(v_uid) then return jsonb_build_object('access', false); end if;

  v_admin := _envers_is_admin(v_uid);
  select * into c from envers_config where id = 1;
  select * into s from envers_stays where user_id = v_uid;
  select travel_started_at, place_id into v_pos from character_positions where user_id = v_uid;

  return jsonb_build_object(
    'access', true,
    'is_admin', v_admin,
    'now', now(),
    'inside', coalesce(s.inside, false),
    'entered_at', s.entered_at,
    'last_tick_at', s.last_tick_at,
    'ends_at', s.ends_at,
    'speed_kmh', case when coalesce(s.inside, false) then s.speed_kmh else _envers_speed(v_uid) end,
    'session_km', coalesce(s.session_km, 0),
    'km_total', coalesce(s.km_total, 0),
    'found_count', coalesce(s.found_count, 0),
    'session_hours', c.session_hours,
    'km_multiplier', c.km_multiplier,
    'traveling', v_pos.travel_started_at is not null,
    'has_position', v_pos.place_id is not null or v_pos.travel_started_at is not null,
    'balance', (select balance from wallets where user_id = v_uid),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'name', i.name, 'description', i.description,
                                          'price', i.price, 'stock', i.stock) order by i.sort, i.created_at)
      from envers_items i where i.is_active
    ), '[]'::jsonb),
    'purchases', coalesce((
      select jsonb_agg(jsonb_build_object('name', p.item_name, 'quantity', p.quantity,
                                          'total', p.total_price, 'at', p.created_at) order by p.created_at desc)
      from (select * from envers_sales where buyer_id = v_uid order by created_at desc limit 12) p
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function envers_enter()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  c envers_config;
  v_pos record;
begin
  if v_uid is null or not _envers_has_access(v_uid) then return jsonb_build_object('error', 'no_access'); end if;
  select * into c from envers_config where id = 1;
  select * into v_pos from character_positions where user_id = v_uid;
  if not found or (v_pos.place_id is null and v_pos.travel_started_at is null) then
    return jsonb_build_object('error', 'no_position');
  end if;
  if v_pos.travel_started_at is not null then return jsonb_build_object('error', 'currently_traveling'); end if;

  perform _envers_tick(v_uid);
  insert into envers_stays (user_id) values (v_uid) on conflict (user_id) do nothing;
  update envers_stays
     set inside = true,
         entered_at = now(),
         last_tick_at = now(),
         ends_at = now() + (c.session_hours || ' hours')::interval,
         speed_kmh = _envers_speed(v_uid),
         session_km = 0
   where user_id = v_uid and not inside;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function envers_leave()
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then return jsonb_build_object('error', 'no_access'); end if;
  perform _envers_tick(auth.uid(), true);
  return jsonb_build_object('success', true);
end;
$$;

-- Discret : fait avancer son propre séjour (la carte l'appelle à
-- l'ouverture, seulement chez ceux qui ont déjà trouvé L'Envers).
create or replace function envers_ping()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is not null then perform _envers_tick(auth.uid()); end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Le Comptoir de l'Envers.
-- ---------------------------------------------------------------------
create or replace function envers_buy(p_item_id uuid, p_quantity int default 1)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item envers_items;
  v_total numeric;
  v_balance numeric;
  v_admins uuid[];
  v_each numeric;
  v_admin uuid;
begin
  if v_uid is null or not _envers_has_access(v_uid) then return jsonb_build_object('error', 'no_access'); end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 999 then return jsonb_build_object('error', 'invalid_quantity'); end if;

  select * into v_item from envers_items where id = p_item_id for update;
  if not found or not v_item.is_active then return jsonb_build_object('error', 'item_not_found'); end if;
  if v_item.stock is not null and v_item.stock < p_quantity then return jsonb_build_object('error', 'out_of_stock'); end if;

  v_total := round(v_item.price * p_quantity, 2);
  select balance into v_balance from wallets where user_id = v_uid for update;
  if v_balance is null or v_balance < v_total then return jsonb_build_object('error', 'insufficient_funds'); end if;

  update wallets set balance = balance - v_total where user_id = v_uid;
  insert into transactions (user_id, amount, reason, created_by)
  values (v_uid, -v_total, 'Comptoir de l''Envers : ' || v_item.name || case when p_quantity > 1 then ' ×' || p_quantity else '' end, v_uid);

  -- L'argent revient à l'administration (partagé, l'acheteur exclu).
  select array_agg(id) into v_admins from profiles where id <> v_uid and _envers_is_admin(id);
  if coalesce(array_length(v_admins, 1), 0) > 0 then
    v_each := round(v_total / array_length(v_admins, 1), 2);
    if v_each > 0 then
      foreach v_admin in array v_admins loop
        update wallets set balance = balance + v_each where user_id = v_admin;
        insert into transactions (user_id, amount, reason, created_by)
        values (v_admin, v_each, 'Vente du Comptoir de l''Envers', v_uid);
      end loop;
    end if;
  end if;

  if v_item.stock is not null then
    update envers_items set stock = stock - p_quantity where id = v_item.id;
  end if;

  insert into envers_sales (item_id, buyer_id, item_name, quantity, total_price)
  values (v_item.id, v_uid, v_item.name, p_quantity, v_total);

  return jsonb_build_object('success', true, 'total', v_total);
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Administration.
-- ---------------------------------------------------------------------
create or replace function envers_admin_get()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  c envers_config;
begin
  if not _envers_is_admin(auth.uid()) then return jsonb_build_object('error', 'forbidden'); end if;
  select * into c from envers_config where id = 1;
  return jsonb_build_object(
    'config', to_jsonb(c),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.sort, i.created_at) from envers_items i), '[]'::jsonb),
    'sales', coalesce((
      select jsonb_agg(jsonb_build_object('item', s.item_name, 'quantity', s.quantity, 'total', s.total_price,
                                          'at', s.created_at, 'buyer', coalesce(nullif(p.nickname, ''), nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), '?')) order by s.created_at desc)
      from (select * from envers_sales order by created_at desc limit 30) s
      left join profiles p on p.id = s.buyer_id
    ), '[]'::jsonb),
    'finders', (select count(*) from envers_stays where first_found_at is not null),
    'inside', (select count(*) from envers_stays where inside and ends_at > now())
  );
end;
$$;

create or replace function envers_admin_set_config(
  p_x numeric default null, p_y numeric default null, p_random boolean default false,
  p_radius numeric default null, p_km_multiplier numeric default null, p_session_hours numeric default null,
  p_is_open boolean default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_size numeric := greatest(coalesce((select world_size from map_settings where id = 1), 100), 100);
  v_x numeric := p_x;
  v_y numeric := p_y;
begin
  if not _envers_is_admin(auth.uid()) then return jsonb_build_object('error', 'forbidden'); end if;
  if p_random then
    v_x := round((8 + random() * (v_size - 16))::numeric, 2);
    v_y := round((8 + random() * (v_size - 16))::numeric, 2);
  end if;
  update envers_config
     set x = coalesce(least(greatest(v_x, 0), v_size), x),
         y = coalesce(least(greatest(v_y, 0), v_size), y),
         moved_at = case when v_x is not null or v_y is not null then now() else moved_at end,
         radius = coalesce(nullif(greatest(p_radius, 0), 0), radius),
         km_multiplier = coalesce(nullif(greatest(p_km_multiplier, 0), 0), km_multiplier),
         session_hours = coalesce(nullif(greatest(p_session_hours, 0), 0), session_hours),
         is_open = coalesce(p_is_open, is_open),
         updated_at = now()
   where id = 1;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function envers_admin_save_item(
  p_id uuid, p_name text, p_description text, p_price numeric, p_stock int, p_is_active boolean default true
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if not _envers_is_admin(auth.uid()) then return jsonb_build_object('error', 'forbidden'); end if;
  if p_name is null or length(trim(p_name)) = 0 then return jsonb_build_object('error', 'invalid_name'); end if;
  if p_price is null or p_price <= 0 then return jsonb_build_object('error', 'invalid_price'); end if;
  if p_stock is not null and p_stock < 0 then return jsonb_build_object('error', 'invalid_stock'); end if;

  if p_id is null then
    insert into envers_items (name, description, price, stock, is_active, sort)
    values (trim(p_name), nullif(trim(coalesce(p_description, '')), ''), p_price, p_stock, coalesce(p_is_active, true),
            coalesce((select max(sort) + 1 from envers_items), 0))
    returning id into v_id;
  else
    update envers_items
       set name = trim(p_name), description = nullif(trim(coalesce(p_description, '')), ''),
           price = p_price, stock = p_stock, is_active = coalesce(p_is_active, true)
     where id = p_id
    returning id into v_id;
  end if;
  return jsonb_build_object('success', v_id is not null, 'id', v_id);
end;
$$;

create or replace function envers_admin_delete_item(p_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
begin
  if not _envers_is_admin(auth.uid()) then return jsonb_build_object('error', 'forbidden'); end if;
  delete from envers_items where id = p_id;
  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function envers_probe(numeric, numeric) from public, anon;
revoke execute on function envers_state() from public, anon;
revoke execute on function envers_enter() from public, anon;
revoke execute on function envers_leave() from public, anon;
revoke execute on function envers_ping() from public, anon;
revoke execute on function envers_buy(uuid, int) from public, anon;
revoke execute on function envers_admin_get() from public, anon;
revoke execute on function envers_admin_set_config(numeric, numeric, boolean, numeric, numeric, numeric, boolean) from public, anon;
revoke execute on function envers_admin_save_item(uuid, text, text, numeric, int, boolean) from public, anon;
revoke execute on function envers_admin_delete_item(uuid) from public, anon;
grant execute on function envers_probe(numeric, numeric) to authenticated;
grant execute on function envers_state() to authenticated;
grant execute on function envers_enter() to authenticated;
grant execute on function envers_leave() to authenticated;
grant execute on function envers_ping() to authenticated;
grant execute on function envers_buy(uuid, int) to authenticated;
grant execute on function envers_admin_get() to authenticated;
grant execute on function envers_admin_set_config(numeric, numeric, boolean, numeric, numeric, numeric, boolean) to authenticated;
grant execute on function envers_admin_save_item(uuid, text, text, numeric, int, boolean) to authenticated;
grant execute on function envers_admin_delete_item(uuid) to authenticated;
