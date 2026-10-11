-- =====================================================================
-- 0112 — Présence en quête sans versement + taille de la carte
-- =====================================================================
-- 1. QUÊTES
-- Avant : après 1 h sur place, la carte appelait
-- validate_quest_participant() du site principal, qui valide ET verse la
-- récompense (et le site principal la verse aussi quand un responsable
-- clique « Valider »).
-- Maintenant : la carte ne touche plus à l'argent ni à la réputation.
-- Elle se contente de confirmer la présence en passant la participation
-- de 'assigned' à 'submitted'. Le versement reste fait par le site
-- principal, au clic sur « Valider » (statut 'validated').
--
-- On n'écrit volontairement PAS 'validated' ici : sur le site principal,
-- ce statut masque le bouton « Valider » et déclenche la notification
-- « ta récompense a été versée » — la récompense ne serait alors jamais
-- payée.
-- ---------------------------------------------------------------------
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

  -- Seules les participations encore 'assigned' sont concernées : la
  -- confirmation n'a lieu (et n'est annoncée) qu'une seule fois.
  for v_quest in
    update quest_participants qp
       set status = 'submitted'
      from quests q
     where q.id = qp.quest_id
       and qp.user_id = auth.uid()
       and qp.status = 'assigned'
       and q.place_id = v_pos.place_id
       and not quest_is_finished(q.status::text)
    returning qp.quest_id as id
  loop
    v_result := v_result || jsonb_build_object('quest_id', v_quest.id, 'validated', true);
  end loop;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. TAILLE DE LA CARTE
-- Côté du monde en unités de carte (100 = taille d'origine). L'agrandir
-- ajoute de l'espace à droite et en bas : rien de ce qui existe ne bouge.
-- ---------------------------------------------------------------------
alter table map_settings
  add column if not exists world_size numeric not null default 100
  check (world_size >= 100 and world_size <= 1000);
