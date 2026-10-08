'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import type { MapTexture } from '@/lib/textures';
import { useTextures } from '@/lib/hooks/useTextures';
import { usePermission } from '@/lib/hooks/usePermission';
import { TexturePreview } from './TextureDefs';

// L'éditeur n'est chargé qu'à la demande (allège le premier chargement).
const TextureEditorModal = dynamic(() => import('./TextureEditorModal'), { ssr: false });

// value : null = automatique (défaut selon le type), 'none' = aucune.
export default function TexturePicker({
  value,
  onChange
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const { all, reload } = useTextures();
  const { allowed: canEdit } = usePermission('manage_map');
  const [showEditor, setShowEditor] = useState(false);
  const [editorSeed, setEditorSeed] = useState<MapTexture | undefined>(undefined);
  const supabase = createClient();

  async function remove(t: MapTexture) {
    if (!confirm(`Supprimer la texture « ${t.name} » ?`)) return;
    await supabase.from('map_textures').delete().eq('id', t.id);
    if (value === t.id) onChange(null);
    reload();
  }

  const base = 'flex flex-col items-center gap-1 rounded-lg border p-1.5 text-[10px] transition';
  const on = 'border-accent bg-accent/10 text-paper';
  const off = 'border-white/10 bg-white/5 text-paper/60 hover:border-white/30';

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-wide text-paper/50">Texture</label>
      <div className="grid max-h-44 grid-cols-4 gap-1.5 overflow-y-auto scrollbar-thin pr-1">
        <button type="button" onClick={() => onChange(null)} className={`${base} ${value === null ? on : off}`}>
          <span className="flex h-10 w-10 items-center justify-center text-lg">✨</span>
          Auto
        </button>
        <button type="button" onClick={() => onChange('none')} className={`${base} ${value === 'none' ? on : off}`}>
          <span className="flex h-10 w-10 items-center justify-center text-lg">⬜</span>
          Aucune
        </button>
        {all.map((t) => (
          <div key={t.id} className="relative">
            <button type="button" onClick={() => onChange(t.id)} className={`${base} w-full ${value === t.id ? on : off}`}>
              <TexturePreview t={t} uid={t.id} />
              <span className="w-full truncate text-center">{t.name}</span>
            </button>
            {canEdit && (
              <span className="absolute right-0.5 top-0.5 flex gap-0.5">
                <button
                  type="button"
                  title={t.id.startsWith('builtin:') ? 'Dupliquer et modifier' : 'Modifier'}
                  onClick={() => {
                    setEditorSeed(t);
                    setShowEditor(true);
                  }}
                  className="rounded bg-black/50 px-1 text-[10px] text-paper/80 hover:text-accent"
                >
                  ✎
                </button>
                {!t.id.startsWith('builtin:') && (
                  <button
                    type="button"
                    title="Supprimer"
                    onClick={() => remove(t)}
                    className="rounded bg-black/50 px-1 text-[10px] text-paper/80 hover:text-accent"
                  >
                    🗑
                  </button>
                )}
              </span>
            )}
          </div>
        ))}
      </div>
      {canEdit && (
        <button
          type="button"
          onClick={() => {
            setEditorSeed(undefined);
            setShowEditor(true);
          }}
          className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-paper/70 hover:border-accent hover:text-accent"
        >
          ➕ Créer / dessiner une texture
        </button>
      )}
      {showEditor && (
        <TextureEditorModal
          initial={editorSeed}
          onClose={() => setShowEditor(false)}
          onSaved={async (id) => {
            await reload();
            onChange(id);
            setShowEditor(false);
          }}
        />
      )}
    </div>
  );
}
