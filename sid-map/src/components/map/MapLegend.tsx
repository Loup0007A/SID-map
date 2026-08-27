'use client';

import { useState } from 'react';
import { usePermission } from '@/lib/hooks/usePermission';
import IconPicker from './IconPicker';

export interface LegendItem {
  key: string;
  icon?: string;
  color?: string;
  label: string;
}

export interface LegendSection {
  title: string;
  category?: 'place' | 'building';
  items: LegendItem[];
  onIconChange?: (key: string, icon: string) => void;
  onAddType?: (key: string, label: string, icon: string) => void;
}

function slugify(label: string) {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export default function MapLegend({ sections }: { sections: LegendSection[] }) {
  const { allowed: canEdit } = usePermission('manage_map');
  const [open, setOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [addingSection, setAddingSection] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newIcon, setNewIcon] = useState('📍');

  return (
    <div className="absolute bottom-3 right-4 z-20">
      {open && (
        <div className="glass-strong mb-2 max-h-[65vh] w-64 space-y-4 overflow-y-auto scrollbar-thin rounded-2xl p-3">
          {sections.map((s) => (
            <div key={s.title}>
              <p className="mb-1 font-display text-[10px] uppercase tracking-wide text-accent">{s.title}</p>
              <div className="space-y-1">
                {s.items.map((it) => (
                  <div key={it.key} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-paper/80">
                      {it.icon && (
                        <button
                          disabled={!canEdit || !s.onIconChange}
                          onClick={() => setEditingKey(editingKey === it.key ? null : it.key)}
                          className={`w-5 text-center ${canEdit && s.onIconChange ? 'hover:scale-110' : ''}`}
                          title={canEdit && s.onIconChange ? "Changer l'icône" : undefined}
                        >
                          {it.icon}
                        </button>
                      )}
                      {it.color && (
                        <span
                          className="h-3 w-3 shrink-0 rounded-sm border border-white/20"
                          style={{ backgroundColor: it.color }}
                        />
                      )}
                      <span className="truncate">{it.label}</span>
                    </div>
                    {editingKey === it.key && s.onIconChange && (
                      <IconPicker
                        value={it.icon ?? ''}
                        onChange={(icon) => {
                          s.onIconChange!(it.key, icon);
                          setEditingKey(null);
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>

              {canEdit && s.onAddType && (
                <div className="mt-2 border-t border-white/10 pt-2">
                  {addingSection === s.title ? (
                    <div className="space-y-1.5">
                      <input
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        placeholder="Nom du nouveau type"
                        className="w-full glass-input rounded-lg px-2 py-1 text-xs outline-none"
                      />
                      <IconPicker value={newIcon} onChange={setNewIcon} />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            if (!newLabel.trim()) return;
                            s.onAddType!(slugify(newLabel) || `type_${Date.now()}`, newLabel.trim(), newIcon);
                            setAddingSection(null);
                            setNewLabel('');
                            setNewIcon('📍');
                          }}
                          className="btn-accent flex-1 rounded-lg py-1 text-xs text-paper"
                        >
                          Ajouter
                        </button>
                        <button
                          onClick={() => setAddingSection(null)}
                          className="rounded-lg border border-white/15 px-2 py-1 text-xs text-paper/60"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingSection(s.title)}
                      className="w-full rounded-lg border border-dashed border-accent/40 py-1 text-xs text-accent hover:bg-accent/10"
                    >
                      + Nouveau type
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="glass ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[10px] uppercase tracking-wide text-paper/70 hover:text-accent"
      >
        ℹ Légende
      </button>
    </div>
  );
}
