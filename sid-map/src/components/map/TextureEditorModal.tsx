'use client';

import { useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';
import { simplifyPath } from '@/lib/geometry';
import { MOTIFS, type DrawnStroke, type MapTexture } from '@/lib/textures';
import { TexturePreview, strokePath } from './TextureDefs';

type Tool = 'pen' | 'shape' | 'erase';

export default function TextureEditorModal({
  initial,
  onClose,
  onSaved
}: {
  initial?: MapTexture;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const supabase = createClient();
  const { showToast } = useToast();
  const editing = initial && !initial.id.startsWith('builtin:') ? initial : null;
  const seed = initial;

  const [name, setName] = useState(editing ? editing.name : seed ? `${seed.name} (copie)` : '');
  const [motif, setMotif] = useState(seed?.motif ?? 'custom');
  const [glyph, setGlyph] = useState(seed?.glyph ?? '🌲');
  const [color, setColor] = useState(seed?.color ?? '#3b2f2a');
  const [bg, setBg] = useState<string | null>(seed ? seed.bg : '#8a7a68');
  const [bgOpacity, setBgOpacity] = useState(seed?.bgOpacity ?? 1);
  const [size, setSize] = useState(seed?.size ?? 4);
  const [opacity, setOpacity] = useState(seed?.opacity ?? 0.9);
  const [rotation, setRotation] = useState(seed?.rotation ?? 0);
  const [stagger, setStagger] = useState(seed?.stagger ?? false);
  const [strokes, setStrokes] = useState<DrawnStroke[]>(seed?.drawing ?? []);
  const [saving, setSaving] = useState(false);

  // Outils de dessin
  const [tool, setTool] = useState<Tool>('pen');
  const [ink, setInk] = useState(seed?.color ?? '#3b2f2a');
  const [width, setWidth] = useState(0.7);
  const [current, setCurrent] = useState<{ x: number; y: number }[] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const draft: MapTexture = {
    id: 'draft',
    name,
    motif,
    glyph: motif === 'glyph' ? glyph : null,
    color,
    bg,
    bgOpacity,
    drawing: motif === 'custom' ? strokes : null,
    size,
    opacity,
    rotation,
    stagger
  };

  function toLocal(e: React.PointerEvent) {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: Math.min(10, Math.max(0, Math.round(p.x * 20) / 20)), y: Math.min(10, Math.max(0, Math.round(p.y * 20) / 20)) };
  }

  function down(e: React.PointerEvent) {
    if (tool === 'erase') return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setCurrent([toLocal(e)]);
  }
  function move(e: React.PointerEvent) {
    if (!current) return;
    const p = toLocal(e);
    const last = current[current.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) > 0.08) setCurrent([...current, p]);
  }
  function up() {
    if (!current) return;
    const pts = simplifyPath(current, 0.06);
    if (pts.length >= 1) {
      setStrokes((s) => [...s, { pts, color: ink, width, fill: tool === 'shape' && pts.length >= 3 }]);
    }
    setCurrent(null);
  }

  async function save() {
    if (!name.trim()) return showToast('Donne un nom à la texture.', 'error');
    if (motif === 'custom' && strokes.length === 0) return showToast('Dessine au moins un trait.', 'error');
    setSaving(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    const payload = {
      name: name.trim().slice(0, 40),
      motif,
      glyph: draft.glyph,
      color,
      bg,
      bg_opacity: bgOpacity,
      drawing: draft.drawing,
      size,
      opacity,
      rotation,
      stagger
    };
    const q = editing
      ? supabase.from('map_textures').update(payload).eq('id', editing.id).select('id').single()
      : supabase.from('map_textures').insert({ ...payload, created_by: user?.id ?? null }).select('id').single();
    const { data, error } = await q;
    setSaving(false);
    if (error || !data) showToast('Impossible d\'enregistrer la texture.', 'error');
    else {
      showToast(editing ? 'Texture mise à jour.' : 'Texture créée.');
      onSaved(data.id);
    }
  }

  const row = 'flex items-center justify-between text-[11px] uppercase tracking-wide text-paper/50';
  const toolBtn = (t: Tool, label: string) => (
    <button
      type="button"
      onClick={() => setTool(t)}
      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs ${
        tool === t ? 'btn-accent border-transparent text-paper' : 'border-white/15 bg-white/5 text-paper/70'
      }`}
    >
      {label}
    </button>
  );

  return (
    <Modal
      title={editing ? 'Modifier la texture' : 'Nouvelle texture'}
      onClose={onClose}
      maxWidth="max-w-sm"
      footer={
        <button
    onClick={save}
    disabled={saving}
    className="btn-accent w-full rounded-lg py-2.5 text-sm font-semibold text-paper disabled:opacity-50"
  >
    {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer la texture'}
  </button>
      }
    >
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

        {motif === 'custom' && (
          <div className="space-y-2">
            <div className="flex gap-1.5">
              {toolBtn('pen', '✏️ Trait')}
              {toolBtn('shape', '⬟ Forme pleine')}
              {toolBtn('erase', '🧽 Gomme')}
            </div>
            <svg
              ref={svgRef}
              viewBox="0 0 10 10"
              style={{ touchAction: 'none' }}
              className={`mx-auto aspect-square max-h-[40vh] w-full rounded-lg border border-white/20 ${tool === 'erase' ? 'cursor-pointer' : 'cursor-crosshair'}`}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
            >
              <rect width={10} height={10} fill={bg ?? '#222'} fillOpacity={bg ? bgOpacity : 1} />
              <path d="M5 0V10M0 5H10" stroke="#ffffff22" strokeWidth={0.04} />
              <rect width={10} height={10} fill="none" stroke="#ffffff44" strokeWidth={0.08} strokeDasharray="0.3 0.3" />
              {strokes.map((st, i) => (
                <path
                  key={i}
                  d={strokePath(st.pts, st.fill)}
                  fill={st.fill ? st.color : 'none'}
                  stroke={st.color}
                  strokeWidth={st.width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ cursor: tool === 'erase' ? 'pointer' : undefined }}
                  onPointerDown={(e) => {
                    if (tool !== 'erase') return;
                    e.stopPropagation();
                    setStrokes((s) => s.filter((_, j) => j !== i));
                  }}
                />
              ))}
              {current && (
                <path
                  d={strokePath(current, tool === 'shape')}
                  fill={tool === 'shape' ? ink : 'none'}
                  fillOpacity={0.6}
                  stroke={ink}
                  strokeWidth={width}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-[11px] uppercase tracking-wide text-paper/50">
                Encre
                <input
                  type="color"
                  value={ink}
                  onChange={(e) => {
                    setInk(e.target.value);
                    setColor(e.target.value);
                  }}
                  className="block h-8 w-full rounded bg-transparent"
                />
              </label>
              <div className="space-y-1">
                <div className={row}>
                  <span>Épaisseur</span>
                  <span className="text-accent">{width.toFixed(1)}</span>
                </div>
                <input type="range" min={0.2} max={2} step={0.1} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-full accent-[#b3261e]" />
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setStrokes((s) => s.slice(0, -1))}
                className="flex-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-paper/70 hover:text-accent"
              >
                ↩ Annuler
              </button>
              <button
                type="button"
                onClick={() => setStrokes([])}
                className="flex-1 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-paper/70 hover:text-accent"
              >
                🗑 Tout effacer
              </button>
            </div>
            <p className="text-[10px] text-paper/40">
              Dessine dans la tuile : elle se répète sur tout le terrain (aperçu en haut à gauche). Reste dans le cadre pointillé pour un motif régulier.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {motif !== 'custom' && (
            <label className="space-y-1 text-[11px] uppercase tracking-wide text-paper/50">
              Couleur du motif
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="block h-8 w-full rounded bg-transparent" />
            </label>
          )}
          <div className="space-y-1 text-[11px] uppercase tracking-wide text-paper/50">
            Couleur de fond (terrain)
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
                onChange={(e) => setBg(e.target.checked ? '#8a7a68' : null)}
                className="h-4 w-4 accent-[#b3261e]"
                title="Activer le fond (remplace la couleur du biome / relief)"
              />
            </div>
          </div>
        </div>

        {bg !== null && (
          <div className="space-y-1">
            <div className={row}>
              <span>Opacité du fond</span>
              <span className="text-accent">{Math.round(bgOpacity * 100)}%</span>
            </div>
            <input type="range" min={0.1} max={1} step={0.05} value={bgOpacity} onChange={(e) => setBgOpacity(Number(e.target.value))} className="w-full accent-[#b3261e]" />
          </div>
        )}

        <div className="space-y-1">
          <div className={row}>
            <span>Taille de la tuile</span>
            <span className="text-accent">{size.toFixed(1)}</span>
          </div>
          <input type="range" min={1} max={12} step={0.2} value={size} onChange={(e) => setSize(Number(e.target.value))} className="w-full accent-[#b3261e]" />
        </div>
        <div className="space-y-1">
          <div className={row}>
            <span>Opacité du motif</span>
            <span className="text-accent">{Math.round(opacity * 100)}%</span>
          </div>
          <input type="range" min={0.1} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="w-full accent-[#b3261e]" />
        </div>
        <div className="space-y-1">
          <div className={row}>
            <span>Rotation</span>
            <span className="text-accent">{rotation}°</span>
          </div>
          <input type="range" min={0} max={180} step={5} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full accent-[#b3261e]" />
        </div>
        <label className="flex items-center gap-2 text-xs text-paper/70">
          <input type="checkbox" checked={stagger} onChange={(e) => setStagger(e.target.checked)} className="h-4 w-4 accent-[#b3261e]" />
          Quinconce (deux motifs par tuile)
        </label>

      </div>
    </Modal>
  );
}
