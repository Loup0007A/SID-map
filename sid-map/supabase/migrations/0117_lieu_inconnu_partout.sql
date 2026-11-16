-- =====================================================================
-- 0117 — Lot 81 : « Lieu inconnu » sur les trois sites
-- =====================================================================
-- Rejouable. À lancer après 0116.
--
-- Un membre brouillé depuis L'Envers n'a plus de marqueur sur la carte des
-- autres (côté site, rien ne change ici pour la carte). Son pseudo et son
-- avatar « buguent » sur la Cartographie, le Dossier Central et le Wiki :
-- les trois sites lisent la liste ci-dessous.
--
-- Ni lieu ni identifiant : seulement le pseudo et l'avatar, déjà visibles
-- partout. Ouvert aussi sans session, pour le rendu des pages côté serveur.
-- Les comptes invisibles et ceux qui ont masqué leur position n'y sont pas.
-- =====================================================================

create or replace function public.glitched_members()
returns table (nickname text, avatar_url text)
language sql stable security definer
set search_path = public
as $$
  select pr.nickname, pr.avatar_url
  from character_positions cp
  join profiles pr on pr.id = cp.user_id
  where cp.glitched = true
    and cp.is_visible = true
    and pr.status = 'active'
    and coalesce(pr.is_invisible, false) = false
    and length(trim(coalesce(pr.nickname, ''))) >= 2
  order by pr.nickname;
$$;

revoke all on function public.glitched_members() from public;
grant execute on function public.glitched_members() to anon, authenticated;
