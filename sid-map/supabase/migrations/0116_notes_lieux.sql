-- =====================================================================
-- 0116 — Carnet de route : notes privées sur les lieux (Lot 60)
-- =====================================================================
-- Chaque membre peut garder une note sur n'importe quel lieu de la carte
-- (« marchand pas cher », « attention aux loups »…). Personne d'autre ne la
-- voit, pas même les admins. Une note par lieu et par membre.
-- =====================================================================

create table if not exists map_place_notes (
  user_id uuid not null references profiles(id) on delete cascade,
  place_id uuid not null references map_places(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  color text not null default 'kraft' check (color in ('kraft', 'rouge', 'vert', 'bleu')),
  updated_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

create index if not exists map_place_notes_user_idx on map_place_notes (user_id);

alter table map_place_notes enable row level security;

drop policy if exists map_place_notes_own on map_place_notes;
create policy map_place_notes_own on map_place_notes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on map_place_notes to authenticated;
revoke all on map_place_notes from anon;
