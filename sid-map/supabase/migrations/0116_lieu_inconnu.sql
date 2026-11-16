-- =====================================================================
-- 0116 — Lot 80 : « Lieu inconnu » (L'Envers)
-- =====================================================================
-- Rejouable. À lancer après 0115.
--
-- Depuis L'Envers, un membre peut brouiller sa position : les autres le
-- voient sur la carte comme un bug (« Lieu inconnu », marqueur qui saute
-- d'un endroit à l'autre), sans jamais recevoir son vrai lieu. Lui garde sa
-- position normale.
--
--   - Activer : seulement avec un accès à L'Envers (faille trouvée depuis
--     moins d'une heure, ou sur le Chemin sans fin), ou pour les admins de
--     L'Envers.
--   - Couper : à tout moment (panneau de L'Envers, ou « Ma position »).
-- =====================================================================

alter table public.character_positions add column if not exists glitched boolean not null default false;

-- Les autres ne lisent plus la ligne d'un membre brouillé, ni par la table,
-- ni par le temps réel.
drop policy if exists "character_positions_select" on public.character_positions;
create policy "character_positions_select" on public.character_positions for select
  to authenticated using ((is_visible = true and glitched = false) or user_id = auth.uid());

-- Pas de raccourci : glitched ne change que par position_glitch().
create or replace function public.protect_character_position_glitch()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') and new.glitched is distinct from old.glitched then
    raise exception 'Passe par L''Envers pour brouiller ta position.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_character_position_glitch on public.character_positions;
create trigger trg_protect_character_position_glitch
  before update on public.character_positions
  for each row execute function public.protect_character_position_glitch();

-- Présences (reprise de 0113) : un membre brouillé apparaît sans aucune
-- information de lieu ni de trajet.
create or replace function public.list_active_positions()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by t.updated_at desc), '[]'::jsonb)
  from (
    select cp.user_id, cp.place_id, cp.building_id, cp.route_id, cp.route_progress,
           cp.note, cp.is_visible, cp.updated_at,
           cp.status, cp.arrived_at, cp.travel_started_at, cp.travel_duration_minutes,
           cp.flight_target_place_id, cp.planned_path,
           case when cp.mount_expires_at is null or cp.mount_expires_at > now()
                then cp.active_mount_id end as active_mount_id,
           case when cp.mount_expires_at is null or cp.mount_expires_at > now()
                then cp.mount_expires_at end as mount_expires_at,
           cp.glitched,
           pr.nickname, pr.avatar_url, pr.member_rank
    from character_positions cp
    join profiles pr on pr.id = cp.user_id
    where (cp.is_visible = true and cp.glitched = false) or cp.user_id = auth.uid()
    union all
    select cp.user_id, null::uuid, null::uuid, null::uuid, null::numeric,
           null::text, true, cp.updated_at,
           cp.status, null::timestamptz, null::timestamptz, null::integer,
           null::uuid, null::jsonb,
           null::uuid, null::timestamptz,
           true,
           pr.nickname, pr.avatar_url, pr.member_rank
    from character_positions cp
    join profiles pr on pr.id = cp.user_id
    where cp.glitched = true and cp.is_visible = true
      and cp.user_id is distinct from auth.uid()
  ) t;
$$;

-- Lire (p_on null), activer (true) ou couper (false) le brouillage.
create or replace function public.position_glitch(p_on boolean default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_has boolean;
  v_glitched boolean;
  v_access boolean;
begin
  if v_uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;
  select true, glitched into v_has, v_glitched from character_positions where user_id = v_uid;
  v_has := coalesce(v_has, false);
  v_access := _envers_has_access(v_uid);

  if p_on is not null then
    if not v_has then
      return jsonb_build_object('error', 'no_position');
    end if;
    if p_on and not v_access then
      return jsonb_build_object('error', 'no_access');
    end if;
    update character_positions set glitched = p_on where user_id = v_uid;
    v_glitched := p_on;
  end if;

  return jsonb_build_object('glitched', coalesce(v_glitched, false), 'has_position', v_has, 'can_glitch', v_access);
end;
$$;

revoke execute on function public.position_glitch(boolean) from public, anon;
grant execute on function public.position_glitch(boolean) to authenticated;

notify pgrst, 'reload schema';
