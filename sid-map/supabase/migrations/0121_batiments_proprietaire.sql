-- =====================================================================
-- 0121 — Bâtiments : ce que le propriétaire peut changer (Lot 96)
-- À lancer après 0120. Peut être relancée sans risque.
--
-- Le propriétaire d'un bâtiment pouvait changer, depuis le navigateur,
-- tous ses champs : type, position, taille, rotation, créateur… Il ne
-- peut plus changer que la description et l'image (ce que propose la
-- page du bâtiment). La gestion de la carte (manage_map) garde tout.
-- =====================================================================

create or replace function public._batiment_garde_proprietaire()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.has_permission(auth.uid(), 'manage_map') then
    return new;
  end if;
  if (to_jsonb(new) - array['description', 'image_url', 'updated_at'])
     is distinct from (to_jsonb(old) - array['description', 'image_url', 'updated_at']) then
    raise exception 'Permission refusée : le propriétaire ne change que la description et l''image.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_batiment_garde_proprietaire on public.city_buildings;
create trigger trg_batiment_garde_proprietaire before update on public.city_buildings
  for each row execute function public._batiment_garde_proprietaire();
