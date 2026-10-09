-- =====================================================================
-- 0204 — Économie d'espace
--  * modèles 3D : une seule animation par fichier (le site allège le .glb avant envoi),
--    donc plafond du bucket ramené à 10 Mo ;
--  * images : compressées par le site (WebP, 1600 px) => plafond 3 Mo ;
--  * historique des versions : 20 par fiche au lieu de 50 (les plus anciennes sont purgées).
-- À exécuter APRÈS 0203.
-- =====================================================================

update storage.buckets set file_size_limit = 10485760 where id = 'wiki-models';
update storage.buckets set file_size_limit = 3145728  where id = 'wiki-images';

create or replace function public.wiki_entries_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.title, old.summary, old.content, old.tags, old.infobox)
     is distinct from (new.title, new.summary, new.content, new.tags, new.infobox) then
    insert into public.wiki_revisions (entry_id, title, summary, content, tags, infobox, edited_by)
    values (old.id, old.title, old.summary, old.content, old.tags, old.infobox, auth.uid());

    delete from public.wiki_revisions r
    where r.entry_id = old.id
      and r.id not in (
        select r2.id from public.wiki_revisions r2
        where r2.entry_id = old.id
        order by r2.created_at desc
        limit 20
      );
  end if;
  return new;
end;
$$;

-- Purge immédiate de l'existant
delete from public.wiki_revisions r
where r.id in (
  select id from (
    select id, row_number() over (partition by entry_id order by created_at desc) as rn
    from public.wiki_revisions
  ) t
  where t.rn > 20
);

-- NB : les anciens fichiers .glb déjà envoyés sont allégés automatiquement la prochaine fois
-- que tu ouvres et enregistres la fiche (le site ne garde que l'animation choisie et supprime l'ancien fichier).
