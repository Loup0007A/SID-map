-- =====================================================================
-- 0110 : CORRECTIF. list_active_positions (0103) ne renvoyait pas les
-- colonnes ajoutées en 0105 (monture active, voyage en cours, statut,
-- arrivée…). Résultat : monture louée mais jamais « équipée » côté
-- interface, voyages/chrono invisibles. On la redéfinit complète.
-- + unequip_mount() pour rendre sa monture.
-- =====================================================================

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
           cp.flight_target_place_id, cp.active_mount_id,
           pr.nickname, pr.avatar_url, pr.member_rank
    from character_positions cp
    join profiles pr on pr.id = cp.user_id
    where cp.is_visible = true or cp.user_id = auth.uid()
    order by cp.updated_at desc
  ) t;
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
  update character_positions set active_mount_id = null where user_id = auth.uid();
  return jsonb_build_object('success', true);
end;
$$;
