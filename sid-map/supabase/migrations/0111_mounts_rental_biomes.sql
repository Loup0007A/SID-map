-- =====================================================================
-- 0111 : location de monture limitée dans le temps (24 h par défaut),
-- biomes traversables par monture, journal de locations (stats),
-- vol libre. Additif. Redéfinit rent_mount, start_journey et
-- list_active_positions.
-- =====================================================================

alter table mount_types add column if not exists rental_hours numeric not null default 24 check (rental_hours > 0);
alter table mount_types add column if not exists allowed_biomes text[];   -- null / vide = tous les biomes
alter table character_positions add column if not exists mount_expires_at timestamptz;

create table if not exists mount_rental_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  mount_type_id uuid references mount_types(id) on delete set null,
  place_id uuid references map_places(id) on delete set null,
  price numeric not null,
  admin_share numeric not null default 0,
  rented_at timestamptz not null default now(),
  expires_at timestamptz
);
alter table mount_rental_log enable row level security;
drop policy if exists "mount_log_select" on mount_rental_log;
create policy "mount_log_select" on mount_rental_log for select to authenticated
  using (user_id = auth.uid() or has_permission(auth.uid(), 'manage_map'));
-- pas de politique d'écriture : seul rent_mount (SECURITY DEFINER) écrit.

-- ---------------------------------------------------------------------
-- Géométrie : point dans polygone + biome interdit le long d'un tracé
-- ---------------------------------------------------------------------
create or replace function point_in_poly(px numeric, py numeric, pts jsonb)
returns boolean
language plpgsql immutable
as $$
declare
  n int := jsonb_array_length(pts);
  i int;
  j int;
  xi numeric; yi numeric; xj numeric; yj numeric;
  inside boolean := false;
begin
  if n < 3 then return false; end if;
  j := n - 1;
  for i in 0..n-1 loop
    xi := (pts->i->>'x')::numeric; yi := (pts->i->>'y')::numeric;
    xj := (pts->j->>'x')::numeric; yj := (pts->j->>'y')::numeric;
    if ((yi > py) <> (yj > py)) and (px < (xj - xi) * (py - yi) / nullif(yj - yi, 0) + xi) then
      inside := not inside;
    end if;
    j := i;
  end loop;
  return inside;
end;
$$;

-- Renvoie le type du premier biome INTERDIT traversé par la polyligne, sinon null.
create or replace function path_blocked_biome(p_points jsonb, p_allowed text[])
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  n int := jsonb_array_length(p_points);
  i int;
  steps int;
  s int;
  ax numeric; ay numeric; bx numeric; by numeric;
  px numeric; py numeric;
  b record;
begin
  if p_allowed is null or cardinality(p_allowed) = 0 or n < 2 then
    return null;
  end if;
  for i in 0..n-2 loop
    ax := (p_points->i->>'x')::numeric;   ay := (p_points->i->>'y')::numeric;
    bx := (p_points->(i+1)->>'x')::numeric; by := (p_points->(i+1)->>'y')::numeric;
    steps := greatest(1, ceil(sqrt(power(bx-ax,2)+power(by-ay,2)) / 0.5)::int);
    for s in 0..steps loop
      px := ax + (bx-ax) * s / steps;
      py := ay + (by-ay) * s / steps;
      for b in select biome_type, path_points from map_biomes
               where is_published and not (biome_type = any(p_allowed)) loop
        if point_in_poly(px, py, b.path_points) then
          return b.biome_type;
        end if;
      end loop;
    end loop;
  end loop;
  return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Positions : la monture expirée n'est plus renvoyée
-- ---------------------------------------------------------------------
create or replace function list_active_positions()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select cp.user_id, cp.place_id, cp.building_id, cp.route_id, cp.route_progress,
           cp.note, cp.is_visible, cp.updated_at,
           cp.status, cp.arrived_at, cp.travel_started_at, cp.travel_duration_minutes,
           cp.flight_target_place_id,
           case when cp.mount_expires_at is null or cp.mount_expires_at > now()
                then cp.active_mount_id end as active_mount_id,
           case when cp.mount_expires_at is null or cp.mount_expires_at > now()
                then cp.mount_expires_at end as mount_expires_at,
           pr.nickname, pr.avatar_url, pr.member_rank
    from character_positions cp
    join profiles pr on pr.id = cp.user_id
    where cp.is_visible = true or cp.user_id = auth.uid()
    order by cp.updated_at desc
  ) t;
$$;

-- ---------------------------------------------------------------------
-- Location : valable rental_hours (24 h par défaut). 50 % aux admins.
-- ---------------------------------------------------------------------
create or replace function rent_mount(p_rental_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_price numeric;
  v_owner uuid;
  v_mount_type_id uuid;
  v_place_id uuid;
  v_hours numeric;
  v_pos record;
  v_balance numeric;
  v_admin_share numeric;
  v_expires timestamptz;
begin
  select coalesce(mr.price_override, mt.rental_price), mr.created_by, mr.mount_type_id, mr.place_id, mt.rental_hours
    into v_price, v_owner, v_mount_type_id, v_place_id, v_hours
  from mount_rentals mr
  join mount_types mt on mt.id = mr.mount_type_id
  where mr.id = p_rental_id;

  if v_price is null then
    return jsonb_build_object('error', 'rental_not_found');
  end if;

  select * into v_pos from character_positions where user_id = auth.uid();
  if not found or v_pos.place_id is distinct from v_place_id then
    return jsonb_build_object('error', 'not_at_location');
  end if;
  if v_pos.travel_started_at is not null then
    return jsonb_build_object('error', 'currently_traveling');
  end if;
  if v_pos.active_mount_id = v_mount_type_id
     and v_pos.mount_expires_at is not null and v_pos.mount_expires_at > now() then
    return jsonb_build_object('error', 'already_equipped');
  end if;

  select balance into v_balance from wallets where user_id = auth.uid();
  if v_balance is null or v_balance < v_price then
    return jsonb_build_object('error', 'insufficient_funds');
  end if;

  v_admin_share := round(v_price * 0.5, 2);
  v_expires := now() + make_interval(secs => (coalesce(v_hours, 24) * 3600)::double precision);

  update wallets set balance = balance - v_price where user_id = auth.uid();
  if v_owner is not null then
    update wallets set balance = balance + v_admin_share where user_id = v_owner;
  end if;

  update character_positions
    set active_mount_id = v_mount_type_id, mount_expires_at = v_expires
    where user_id = auth.uid();

  insert into mount_rental_log (user_id, mount_type_id, place_id, price, admin_share, expires_at)
  values (auth.uid(), v_mount_type_id, v_place_id, v_price, v_admin_share, v_expires);

  return jsonb_build_object(
    'success', true, 'mount_type_id', v_mount_type_id,
    'price', v_price, 'admin_share', v_admin_share, 'expires_at', v_expires
  );
end;
$$;

create or replace function unequip_mount()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_pos record;
begin
  select * into v_pos from character_positions where user_id = auth.uid();
  if not found then
    return jsonb_build_object('error', 'no_position');
  end if;
  if v_pos.travel_started_at is not null then
    return jsonb_build_object('error', 'currently_traveling');
  end if;
  update character_positions set active_mount_id = null, mount_expires_at = null where user_id = auth.uid();
  return jsonb_build_object('success', true);
end;
$$;

-- ---------------------------------------------------------------------
-- Voyage : monture expirée ignorée ; biomes interdits refusés ; le vol
-- ne suit aucun chemin (ligne droite vers n'importe quel lieu).
-- ---------------------------------------------------------------------
create or replace function start_journey(p_route_id uuid, p_target_place_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_pos record;
  v_mount record;
  v_route record;
  v_dest uuid;
  v_duration numeric;
  v_from record;
  v_to record;
  v_dist_units numeric;
  v_dist_km numeric;
  v_speed numeric;
  v_set record;
  v_blocked text;
  v_points jsonb;
begin
  select * into v_pos from character_positions where user_id = auth.uid();
  if not found or v_pos.place_id is null then
    return jsonb_build_object('error', 'no_current_place');
  end if;
  if v_pos.travel_started_at is not null then
    return jsonb_build_object('error', 'already_traveling');
  end if;

  -- Monture expirée : on la retire.
  if v_pos.active_mount_id is not null
     and v_pos.mount_expires_at is not null and v_pos.mount_expires_at <= now() then
    update character_positions set active_mount_id = null, mount_expires_at = null where user_id = auth.uid();
    v_pos.active_mount_id := null;
  end if;

  if v_pos.active_mount_id is not null then
    select * into v_mount from mount_types where id = v_pos.active_mount_id;
  end if;

  if p_route_id is not null then
    select * into v_route from map_routes where id = p_route_id;
    if not found then
      return jsonb_build_object('error', 'route_not_found');
    end if;
    if v_route.from_place_id = v_pos.place_id then
      v_dest := v_route.to_place_id;
    elsif v_route.to_place_id = v_pos.place_id then
      v_dest := v_route.from_place_id;
    else
      return jsonb_build_object('error', 'route_not_connected');
    end if;

    if v_mount.allowed_biomes is not null and cardinality(v_mount.allowed_biomes) > 0 then
      select x, y into v_from from map_places where id = v_route.from_place_id;
      select x, y into v_to from map_places where id = v_route.to_place_id;
      v_points := jsonb_build_array(jsonb_build_object('x', v_from.x, 'y', v_from.y))
                  || coalesce(v_route.path_points, '[]'::jsonb)
                  || jsonb_build_array(jsonb_build_object('x', v_to.x, 'y', v_to.y));
      v_blocked := path_blocked_biome(v_points, v_mount.allowed_biomes);
      if v_blocked is not null then
        return jsonb_build_object('error', 'forbidden_biome', 'biome', v_blocked);
      end if;
    end if;

    v_duration := coalesce(v_route.travel_minutes, 30) / coalesce(v_mount.speed_multiplier, 1);

    update character_positions set
      route_id = p_route_id,
      route_progress = 0,
      flight_target_place_id = null,
      travel_started_at = now(),
      travel_duration_minutes = v_duration,
      building_id = null
    where user_id = auth.uid();

    return jsonb_build_object('success', true, 'destination', v_dest, 'duration_minutes', v_duration);

  elsif p_target_place_id is not null then
    if v_mount.can_fly is not true then
      return jsonb_build_object('error', 'no_flying_mount');
    end if;
    if p_target_place_id = v_pos.place_id then
      return jsonb_build_object('error', 'same_place');
    end if;

    select x, y into v_from from map_places where id = v_pos.place_id;
    select x, y into v_to from map_places where id = p_target_place_id;
    if v_from is null or v_to is null then
      return jsonb_build_object('error', 'place_not_found');
    end if;

    select * into v_set from map_settings where id = 1;
    v_dist_units := sqrt(power(v_to.x - v_from.x, 2) + power(v_to.y - v_from.y, 2));
    v_dist_km := v_dist_units * coalesce(v_set.km_per_unit, 5);

    if v_mount.flight_range_km is not null and v_dist_km > v_mount.flight_range_km then
      return jsonb_build_object('error', 'out_of_range', 'distance_km', round(v_dist_km, 1),
                                'range_km', v_mount.flight_range_km);
    end if;

    if v_mount.allowed_biomes is not null and cardinality(v_mount.allowed_biomes) > 0 then
      v_points := jsonb_build_array(jsonb_build_object('x', v_from.x, 'y', v_from.y),
                                    jsonb_build_object('x', v_to.x, 'y', v_to.y));
      v_blocked := path_blocked_biome(v_points, v_mount.allowed_biomes);
      if v_blocked is not null then
        return jsonb_build_object('error', 'forbidden_biome', 'biome', v_blocked);
      end if;
    end if;

    v_speed := coalesce(v_mount.flight_speed_kmh,
                        coalesce(v_set.walk_kmh, 5) * coalesce(v_mount.speed_multiplier, 1));
    v_duration := greatest(2, round((v_dist_km / v_speed) * 60));

    update character_positions set
      route_id = null,
      route_progress = 0,
      flight_target_place_id = p_target_place_id,
      travel_started_at = now(),
      travel_duration_minutes = v_duration,
      building_id = null
    where user_id = auth.uid();

    return jsonb_build_object('success', true, 'destination', p_target_place_id,
                              'duration_minutes', v_duration, 'distance_km', round(v_dist_km, 1));
  else
    return jsonb_build_object('error', 'missing_target');
  end if;
end;
$$;
