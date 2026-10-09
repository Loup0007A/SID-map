-- =====================================================================
-- 0109 : échelle de la carte + vol basé sur les distances réelles.
-- Additif. Le temps de vol = distance (km) / vitesse (km/h).
-- =====================================================================

create table if not exists map_settings (
  id int primary key default 1 check (id = 1),     -- ligne unique
  km_per_unit numeric not null default 5 check (km_per_unit > 0), -- 1 unité de carte = X km
  walk_kmh numeric not null default 5 check (walk_kmh > 0),       -- vitesse de marche
  unit_label text not null default 'km',
  updated_at timestamptz not null default now()
);
insert into map_settings (id) values (1) on conflict (id) do nothing;

alter table map_settings enable row level security;
drop policy if exists "map_settings_select" on map_settings;
create policy "map_settings_select" on map_settings for select to authenticated using (true);
drop policy if exists "map_settings_write" on map_settings;
create policy "map_settings_write" on map_settings for all to authenticated
  using (has_permission(auth.uid(), 'manage_map')) with check (has_permission(auth.uid(), 'manage_map'));

-- Vitesse de vol absolue (km/h) et portée maximale d'un vol (km), facultatives.
alter table mount_types add column if not exists flight_speed_kmh numeric check (flight_speed_kmh is null or flight_speed_kmh > 0);
alter table mount_types add column if not exists flight_range_km numeric check (flight_range_km is null or flight_range_km > 0);

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
begin
  select * into v_pos from character_positions where user_id = auth.uid();
  if not found or v_pos.place_id is null then
    return jsonb_build_object('error', 'no_current_place');
  end if;
  if v_pos.travel_started_at is not null then
    return jsonb_build_object('error', 'already_traveling');
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
