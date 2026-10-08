'use client';

import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { MOTIFS, type MapTexture } from '@/lib/textures';
import { TexturePreview } from './TextureDefs';

export default function TextureEditorModal({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [motif, setMotif] = useState('mountain');
  const [glyph, setGlyph] = useState('🌲');
  const [color, setColor] = useState('#3b2f2a');
  const [bg, setBg] = useState<string | null>(null);
  const [size, setSize] = useState(3);
  const [opacity, setOpacity] = useState(0.75);
  const [rotation, setRotation] = useState(0);
  const [stagger, setStagger] = useState(true);
  const [saving, setSaving] = useState(false);

  const draft: MapTexture = { id: 'draft', name, motif, glyph: motif === 'glyph' ? glyph : null, color, bg, size, opacity, rotation, stagger };

  async function save() {
    if (!name.trim()) return showToast('Donne un nom à la texture.', 'error');
    setSaving(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('map_textures')
      .insert({
        name: name.trim().slice(0, 40),
        motif,
        glyph: draft.glyph,
        color,
        bg,
        size,
        opacity,
        rotation,
        stagger,
        created_by: user?.id ?? null
      })
      .select('id')
      .single();
    setSaving(false);
    if (error || !data) showToast('Impossible de créer la texture.', 'error');
    else {
      showToast('Texture créée.');
      onSaved(data.id);
    }
  }

  const row = 'flex items-center justify-between text-[11px] uppercase tracking-wide text-paper/50';

  return (
    <Modal title="Nouvelle texture" onClose={onClose} maxWidth="max-w-sm">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <TexturePreview t={draft} uid="draft" className="h-20 w-20" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nom (ex : Collines)"
            maxLength={40}
            className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
          />
        </div>

        <select
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          style={{ colorScheme: 'dark' }}
          className="w-full glass-input rounded-lg px-3 py-2 text-sm"
        >
          {Object.entries(MOTIFS).map(([k, m]) => (
            <option key={k} value={k}>
              {m.label}
            </option>
          ))}
        </select>

        {motif === 'glyph' && (
          <input
            value={glyph}
            onChange={(e) => setGlyph(Array.from(e.target.value).slice(0, 2).join(''))}
            placeholder="Un emoji ou un caractère"
            className="w-full glass-input rounded-lg px-3 py-2 text-sm outline-none"
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-[11px] uppercase tracking-wide text-paper/50">
            Couleur du motif
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="block h-8 w-full rounded bg-transparent" />
          </label>
          <div className="space-y-1 text-[11px] uppercase tracking-wide text-paper/50">
            Fond
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={bg ?? '#000000'}
                disabled={bg === null}
                onChange={(e) => setBg(e.target.value)}
                className="h-8 w-full rounded bg-transparent disabled:opacity-30"
              />
              <input
                type="checkbox"
                checked={bg !== null}
                onChange={(e) => setBg(e.target.checked ? '#2a3a2a' : null)}
                className="h-4 w-4 accent-[#b3261e]"
                title="Activer le fond"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className={row}>
            <span>Taille</span>
            <span className="text-accent">{size.toFixed(1)}</span>
          </div>
          <input type="range" min={1} max={10} step={0.2} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-[#b3261e]" />
        </div>
        <div className="space-y-1">
          <div className={row}>
            <span>Opacité</span>
            <span className="text-accent">{Math.round(opacity * 100)}%</span>
          </div>
          <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-[#b3261e]" />
        </div>
        <div className="space-y-1">
          <div className={row}>
            <span>Rotation du motif</span>
            <span className="text-accent">{rotation}°</span>
          </div>
          <input type="range" min={0} max={180} step={5} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full accent-[#b3261e]" />
        </div>
        <label className="flex items-center gap-2 text-xs text-paper/70">
          <input type="checkbox" checked={stagger} onChange={(e) => setStagger(e.target.checked)} className="h-4 w-4 accent-[#b3261e]" />
          Disposition en quinconce (plus naturel)
        </label>

        <button
          onClick={save}
          disabled={saving}
          className="btn-accent w-full rounded-lg py-2.5 text-sm font-semibold text-paper disabled:opacity-50"
        >
          {saving ? 'Enregistrement…' : 'Créer la texture'}
        </button>
      </div>
    </Modal>
  );
}
