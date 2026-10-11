'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ICON_ACCEPT, ICON_CATALOG, ICON_FOLDER, ICON_MAX_BYTES, isImageIcon } from '@/lib/icons';
import { uploadMapImage } from '@/lib/uploadImage';

const BUCKET = 'map-images';

// Sélecteur d'icône : emojis du catalogue, ou image importée (.png, .ico…).
// Les images importées forment une bibliothèque commune, réutilisable.
export default function IconPicker({
  value,
  onChange
}: {
  value: string;
  onChange: (icon: string) => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [library, setLibrary] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadLibrary() {
    const { data } = await supabase.storage.from(BUCKET).list(ICON_FOLDER, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
    setLibrary(
      (data ?? [])
        .filter((f) => f.name && !f.name.startsWith('.'))
        .map((f) => supabase.storage.from(BUCKET).getPublicUrl(`${ICON_FOLDER}/${f.name}`).data.publicUrl)
    );
  }

  useEffect(() => {
    loadLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (!/\.(png|ico|webp|svg|gif|jpe?g)$/i.test(file.name)) return setError('Format non pris en charge : choisis un fichier .png ou .ico.');
    if (file.size > ICON_MAX_BYTES) return setError(`Fichier trop lourd (${Math.round(file.size / 1024)} Ko) : 512 Ko au maximum.`);
    setBusy(true);
    const url = await uploadMapImage(file, ICON_FOLDER);
    setBusy(false);
    if (!url) return setError("Envoi impossible. Il faut la permission d'édition de la carte, et une connexion active.");
    setLibrary((l) => [url, ...l.filter((u) => u !== url)]);
    onChange(url);
  }

  // Une image choisie ailleurs que dans la bibliothèque chargée reste visible.
  const images = isImageIcon(value) && !library.includes(value) ? [value, ...library] : library;
  const cell = (active: boolean) =>
    `flex h-9 w-9 items-center justify-center rounded-lg text-lg transition ${active ? 'bg-accent/30 ring-1 ring-accent' : 'hover:bg-white/10'}`;

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] uppercase tracking-wide text-paper/50">Icône</label>
      <div className="grid grid-cols-6 gap-1 rounded-lg border border-white/10 bg-white/5 p-2">
        {ICON_CATALOG.map((icon) => (
          <button key={icon} type="button" onClick={() => onChange(icon)} className={cell(value === icon)}>
            {icon}
          </button>
        ))}
      </div>

      <div className="space-y-1.5 rounded-lg border border-white/10 bg-white/5 p-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-paper/50">Icônes importées</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="ml-auto rounded-lg border border-dashed border-[#e7c34a]/50 px-2.5 py-1 text-xs text-[#e7c34a] hover:bg-[#e7c34a]/10 disabled:opacity-50"
          >
            {busy ? 'Envoi…' : '+ Importer (.png, .ico)'}
          </button>
          <input ref={fileRef} type="file" accept={ICON_ACCEPT} onChange={onFile} className="hidden" />
        </div>
        {images.length === 0 ? (
          <p className="text-[11px] leading-snug text-paper/45">
            Aucune pour l'instant. Une image carrée à fond transparent rend le mieux ; 512 Ko maximum.
          </p>
        ) : (
          <div className="grid max-h-32 grid-cols-6 gap-1 overflow-y-auto scrollbar-thin">
            {images.map((url) => (
              <button key={url} type="button" onClick={() => onChange(url)} className={cell(value === url)} title="Utiliser cette icône">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" loading="lazy" className="h-6 w-6 object-contain" />
              </button>
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="text-[11px] text-accent">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
