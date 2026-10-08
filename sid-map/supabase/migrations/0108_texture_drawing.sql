-- 0108 : textures dessinées à la main + fond opaque (la texture remplace
-- la couleur du biome/relief). Additif.
alter table map_textures add column if not exists drawing jsonb;
alter table map_textures add column if not exists bg_opacity numeric not null default 1
  check (bg_opacity between 0 and 1);
