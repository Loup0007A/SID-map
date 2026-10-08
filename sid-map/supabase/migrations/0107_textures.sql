-- =====================================================================
-- 0107 : textures de carte (motifs répétés : montagnes, arbres, vagues…)
-- 100 % additif. Une texture = quelques octets de paramètres (pas
-- d'image) ; le rendu utilise des <pattern> SVG.
-- texture_id est du texte : 'builtin:xxx' (préréglage intégré) ou l'uuid
-- d'une texture personnalisée.
-- =====================================================================

create table if not exists map_textures (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  motif text not null default 'triangle',
  glyph text,                                   -- emoji / caractère si motif = 'glyph'
  color text not null default '#3d2b1f',
  bg text,                                      -- fond optionnel
  size numeric not null default 3 check (size between 0.8 and 20),
  opacity numeric not null default 0.7 check (opacity between 0.05 and 1),
  rotation numeric not null default 0,
  stagger boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table map_textures enable row level security;

drop policy if exists "map_textures_select" on map_textures;
create policy "map_textures_select" on map_textures for select to authenticated using (true);

drop policy if exists "map_textures_write" on map_textures;
create policy "map_textures_write" on map_textures for all to authenticated
  using (has_permission(auth.uid(), 'manage_map'))
  with check (has_permission(auth.uid(), 'manage_map'));

alter table map_biomes add column if not exists texture_id text;
alter table map_relief add column if not exists texture_id text;
alter table map_zones  add column if not exists texture_id text;
