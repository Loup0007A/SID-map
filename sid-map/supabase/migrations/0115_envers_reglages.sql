-- =====================================================================
-- 0115 — L'Envers : « Enregistrer les réglages » ne remet plus la faille en 0;0
-- =====================================================================
-- Cause : en PostgreSQL, greatest(NULL, 0) vaut 0 (les NULL sont ignorés).
-- Sans coordonnées (réglages, ouvrir/fermer), x et y étaient donc remis à 0.
-- Les coordonnées ne changent maintenant que si on en donne.
--
-- APRÈS LA MIGRATION : si la faille est en 0;0, la replacer (« Choisir sur la
-- carte » ou « Au hasard » dans Applications → L'Envers).
-- =====================================================================

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
     set x = case when v_x is null then x else least(greatest(v_x, 0), v_size) end,
         y = case when v_y is null then y else least(greatest(v_y, 0), v_size) end,
         moved_at = case when v_x is not null or v_y is not null then now() else moved_at end,
         radius = case when p_radius > 0 then p_radius else radius end,
         km_multiplier = case when p_km_multiplier > 0 then p_km_multiplier else km_multiplier end,
         session_hours = case when p_session_hours > 0 then p_session_hours else session_hours end,
         is_open = coalesce(p_is_open, is_open),
         updated_at = now()
   where id = 1;
  return jsonb_build_object('success', true);
end;
$$;

revoke execute on function envers_admin_set_config(numeric, numeric, boolean, numeric, numeric, numeric, boolean) from public, anon;
grant execute on function envers_admin_set_config(numeric, numeric, boolean, numeric, numeric, numeric, boolean) to authenticated;
