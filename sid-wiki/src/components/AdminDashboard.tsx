'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CATEGORIES, CATEGORY_LABELS, pad, type Category } from '@/lib/wiki';
import { removeStoredFile } from '@/lib/storage';
import { useRouter } from 'next/navigation';
import AdminReports, { type Report } from './AdminReports';
import AdminSettings from './AdminSettings';
import Icon from './Icon';

type Row = {
  id: string;
  category: Category;
  number: number;
  title: string;
  tags: string[];
  discovered: boolean;
  model_url: string | null;
  rarity: number | null;
};

type Overview = {
  id: string;
  has_summary: boolean;
  has_content: boolean;
  has_image: boolean;
  has_discoverer: boolean;
  has_infobox: boolean;
  comments: number;
  favorites: number;
  open_reports: number;
};

type StatusFilter = 'all' | 'hidden' | 'found' | 'incomplete';

/** Ce qui manque à une fiche découverte (vide = fiche complète). */
function missing(r: Row, o: Overview | undefined): string[] {
  if (!r.discovered || !o) return [];
  const m: string[] = [];
  if (!o.has_summary) m.push('résumé');
  if (!o.has_content) m.push('texte');
  if (!o.has_image) m.push('image');
  if (r.tags.length === 0) m.push('tags');
  if (!o.has_infobox) m.push('fiche technique');
  if (!o.has_discoverer) m.push('découvreur');
  return m;
}

type ImportRow = {
  category: Category;
  number: number;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  infobox: { label: string; value: string }[];
  rarity: number | null;
  discovered: boolean;
  image_url: string | null;
  model_url: string | null;
  model_animation: string | null;
};

const EXPORT_COLUMNS =
  'category, number, title, summary, content, tags, infobox, rarity, discovered, image_url, model_url, model_animation';

function parseImport(raw: unknown, defaultCategory: Category): { rows: ImportRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: ImportRow[] = [];
  if (!Array.isArray(raw)) return { rows, errors: ['Le fichier doit contenir une liste JSON ( [ … ] ).'] };

  raw.forEach((r, i) => {
    const where = `Ligne ${i + 1}`;
    if (typeof r !== 'object' || r === null) return errors.push(`${where} : objet attendu.`);
    const o = r as Record<string, unknown>;
    const category = (o.category ?? defaultCategory) as string;
    if (!(CATEGORIES as readonly string[]).includes(category)) return errors.push(`${where} : catégorie « ${category} » inconnue.`);
    const number = Number(o.number);
    if (!Number.isInteger(number) || number < 0 || number > 999) return errors.push(`${where} : numéro invalide (0–999).`);
    if (typeof o.title !== 'string' || !o.title.trim()) return errors.push(`${where} : titre manquant.`);
    const rarity = o.rarity == null ? null : Number(o.rarity);
    if (rarity !== null && (!Number.isInteger(rarity) || rarity < 1 || rarity > 8)) return errors.push(`${where} : rareté entre 1 et 8.`);

    rows.push({
      category: category as Category,
      number,
      title: o.title.trim(),
      summary: typeof o.summary === 'string' ? o.summary : '',
      content: typeof o.content === 'string' ? o.content : '',
      tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string').map((t) => t.trim().toLowerCase()).filter(Boolean) : [],
      infobox: Array.isArray(o.infobox)
        ? o.infobox
            .filter((x): x is { label: string; value: string } => typeof x?.label === 'string' && typeof x?.value === 'string')
            .map((x) => ({ label: x.label, value: x.value }))
        : [],
      rarity,
      discovered: o.discovered === true,
      image_url: typeof o.image_url === 'string' ? o.image_url : null,
      model_url: typeof o.model_url === 'string' ? o.model_url : null,
      model_animation: typeof o.model_animation === 'string' ? o.model_animation : null,
    });
  });
  return { rows, errors };
}

export default function AdminDashboard() {
  const supabase = useMemo(() => createClient(), []);
  const [category, setCategory] = useState<Category>('lieux');
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [tab, setTab] = useState<'entries' | 'reports' | 'settings'>('entries');
  const [overview, setOverview] = useState<Map<string, Overview>>(new Map());
  const [status, setStatus] = useState<StatusFilter>('all');
  const [reports, setReports] = useState<Report[]>([]);
  const [tagInput, setTagInput] = useState('');

  const loadReports = useCallback(async () => {
    const { data } = await supabase.rpc('wiki_reports_list');
    setReports((data ?? []) as Report[]);
  }, [supabase]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    const { data, error } = await supabase
      .from('wiki_entries')
      .select('id, category, number, title, tags, discovered, model_url, rarity')
      .eq('category', category)
      .order('number');
    if (error) setError(error.message);
    else {
      setError(null);
      setRows((data ?? []) as Row[]);
      const { data: ov } = await supabase.rpc('wiki_admin_overview', { p_category: category });
      setOverview(new Map(((ov ?? []) as Overview[]).map((o) => [o.id, o])));
    }
    setLoading(false);
  }, [supabase, category]);

  useEffect(() => {
    load();
  }, [load]);

  const f = filter.trim().toLowerCase();
  const byStatus = rows.filter((r) =>
    status === 'hidden' ? !r.discovered : status === 'found' ? r.discovered : status === 'incomplete' ? missing(r, overview.get(r.id)).length > 0 : true
  );
  const shown = f
    ? byStatus.filter((r) => r.title.toLowerCase().includes(f) || pad(r.number).includes(f) || r.tags.some((t) => t.toLowerCase().includes(f)))
    : byStatus;
  const incompleteCount = rows.filter((r) => missing(r, overview.get(r.id)).length > 0).length;
  const openReports = reports.filter((r) => r.status === 'open').length;
  const totalComments = Array.from(overview.values()).reduce((n, o) => n + o.comments, 0);
  const totalFavorites = Array.from(overview.values()).reduce((n, o) => n + o.favorites, 0);
  const found = rows.filter((r) => r.discovered).length;
  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    setSelected(allShownSelected ? new Set() : new Set(shown.map((r) => r.id)));
  }

  async function setDiscovered(ids: string[], value: boolean) {
    setInfo(null);
    const { error } = await supabase.from('wiki_entries').update({ discovered: value }).in('id', ids);
    if (error) return setError(error.message);
    setError(null);
    setRows((rs) => rs.map((r) => (ids.includes(r.id) ? { ...r, discovered: value } : r)));
    setInfo(`${ids.length} fiche${ids.length > 1 ? 's' : ''} ${value ? 'découverte' : 'masquée'}${ids.length > 1 ? 's' : ''}.`);
  }

  async function removeMany(ids: string[]) {
    const label = ids.length === 1 ? rows.find((r) => r.id === ids[0])?.title ?? 'cette fiche' : `${ids.length} fiches`;
    if (!confirm(`Supprimer définitivement ${label} ? (commentaires, favoris et historique compris)`)) return;
    // Fichiers liés (image, modèle 3D) : on les retire du stockage pour libérer la place
    const { data: files } = await supabase.from('wiki_entries').select('image_url, model_url').in('id', ids);
    const { error } = await supabase.from('wiki_entries').delete().in('id', ids);
    if (error) return setError(error.message);
    setError(null);
    for (const f of files ?? []) {
      await removeStoredFile(supabase, 'wiki-images', f.image_url);
      await removeStoredFile(supabase, 'wiki-models', f.model_url);
    }
    setRows((rs) => rs.filter((r) => !ids.includes(r.id)));
    setSelected(new Set());
  }

  async function duplicate(id: string) {
    setInfo(null);
    const { data, error } = await supabase.rpc('wiki_entry_duplicate', { p_id: id });
    if (error) return setError(error.message);
    setError(null);
    router.push(`/admin/edit/${category}/${pad(data as number)}`);
  }

  /** Ajoute (ou retire) un tag à toutes les fiches sélectionnées. */
  async function bulkTag(mode: 'add' | 'remove') {
    const tag = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (!tag) return setError('Écris d’abord un tag.');
    let n = 0;
    for (const r of rows.filter((x) => selected.has(x.id))) {
      const has = r.tags.includes(tag);
      if (mode === 'add' ? has : !has) continue;
      const tags = mode === 'add' ? [...r.tags, tag] : r.tags.filter((t) => t !== tag);
      const { error } = await supabase.from('wiki_entries').update({ tags }).eq('id', r.id);
      if (error) return setError(error.message);
      n++;
    }
    setError(null);
    setInfo(`Tag #${tag} ${mode === 'add' ? 'ajouté à' : 'retiré de'} ${n} fiche${n > 1 ? 's' : ''}.`);
    load();
  }

  async function exportJson() {
    const { data, error } = await supabase.from('wiki_entries').select(EXPORT_COLUMNS).eq('category', category).order('number');
    if (error) return setError(error.message);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `wiki-${category}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(file: File) {
    setInfo(null);
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return setError('Fichier JSON invalide.');
    }
    const { rows: parsed, errors } = parseImport(raw, category);
    if (errors.length) return setError(errors.slice(0, 5).join(' ') + (errors.length > 5 ? ` … (+${errors.length - 5})` : ''));
    if (parsed.length === 0) return setError('Rien à importer.');
    if (!confirm(`Importer ${parsed.length} fiche(s) ? Les fiches existantes avec le même numéro seront mises à jour.`)) return;

    const { error } = await supabase.from('wiki_entries').upsert(parsed, { onConflict: 'category,number' });
    if (error) return setError(error.message);
    setError(null);
    setInfo(`${parsed.length} fiche(s) importée(s).`);
    load();
  }

  const selIds = Array.from(selected);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="title-grad font-typewriter text-2xl font-bold text-olive-800 sm:text-3xl">🛠 Dashboard</h1>
        <Link href={`/admin/edit/${category}/new`} className="btn">
          + Nouvelle fiche
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-white/15 pb-3">
        <button onClick={() => setTab('entries')} className={tab === 'entries' ? 'btn' : 'btn-ghost'}>📚 Fiches</button>
        <button onClick={() => setTab('reports')} className={tab === 'reports' ? 'btn' : 'btn-ghost'}>
          🚩 Signalements{openReports > 0 && <span className="ml-2 rounded-full bg-stamp px-2 text-xs font-bold text-white">{openReports}</span>}
        </button>
        <button onClick={() => setTab('settings')} className={tab === 'settings' ? 'btn' : 'btn-ghost'}>⚙ Réglages</button>
      </div>

      {tab === 'reports' && <AdminReports reports={reports} onChange={() => { loadReports(); load(); }} />}
      {tab === 'settings' && <AdminSettings />}

      {tab === 'entries' && (
      <>
      <p className="mb-4 text-sm text-olive-700">
        <strong className="text-olive-800">{found}/{rows.length}</strong> découvertes
        {rows.length > 0 && ` (${Math.round((found / rows.length) * 100)} %)`} · <strong className="text-olive-800">{incompleteCount}</strong> à compléter ·{' '}
        <strong className="text-olive-800">{totalComments}</strong> commentaires · <strong className="text-olive-800">{totalFavorites}</strong> favoris
      </p>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&>*]:shrink-0 [&>*]:whitespace-nowrap">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={c === category ? 'btn' : 'btn-ghost'}>
            <Icon name={c} /> {CATEGORY_LABELS[c].label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Filtrer (titre, n°, tag)…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Filtrer par statut">
          <option value="all">Toutes</option>
          <option value="found">Découvertes</option>
          <option value="hidden">Masquées (?)</option>
          <option value="incomplete">À compléter ({incompleteCount})</option>
        </select>
        <span className="ml-auto flex flex-wrap gap-2">
          <button className="btn-ghost !px-3 !py-0.5" onClick={exportJson}>⬇ Exporter JSON</button>
          <label className="btn-ghost !px-3 !py-0.5 cursor-pointer">
            ⬆ Importer JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) importJson(file);
              }}
            />
          </label>
        </span>
      </div>

      {selected.size > 0 && (
        <div className="card mb-3 flex flex-wrap items-center gap-2 p-3">
          <strong className="font-typewriter">{selected.size} sélectionnée{selected.size > 1 ? 's' : ''}</strong>
          <button className="btn !px-3 !py-0.5" onClick={() => setDiscovered(selIds, true)}>Découvrir</button>
          <button className="btn-ghost !px-3 !py-0.5" onClick={() => setDiscovered(selIds, false)}>Masquer</button>
          <span className="flex items-center gap-1">
            <input className="input !w-32 !py-0.5" placeholder="#tag" value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
            <button className="btn-ghost !px-3 !py-0.5" onClick={() => bulkTag('add')}>+ Tag</button>
            <button className="btn-ghost !px-3 !py-0.5" onClick={() => bulkTag('remove')}>− Tag</button>
          </span>
          <button className="btn-danger !px-3 !py-0.5" onClick={() => removeMany(selIds)}>Supprimer</button>
          <button className="btn-ghost !px-3 !py-0.5" onClick={() => setSelected(new Set())}>Annuler</button>
        </div>
      )}

      {error && <p className="mb-3 text-stamp">{error}</p>}
      {info && <p className="mb-3 font-bold text-olive-700">{info}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[22rem] text-left text-sm">
          <thead className="border-b border-white/15 font-typewriter">
            <tr>
              <th className="p-2">
                <input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Tout sélectionner" />
              </th>
              <th className="p-2">N°</th>
              <th className="p-2">Titre</th>
              <th className="hidden p-2 md:table-cell">Tags</th>
              <th className="p-2">Statut</th>
              <th className="p-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-4 italic">Chargement…</td>
              </tr>
            )}
            {!loading && shown.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 italic">Aucune fiche.</td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-white/15">
                <td className="p-2">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Sélectionner ${r.title}`} />
                </td>
                <td className="p-2 font-typewriter">{pad(r.number)}</td>
                <td className="p-2 font-semibold">
                  {r.title}
                  {r.rarity ? <span className="ml-2 text-brass-500">{'★'.repeat(r.rarity)}</span> : null}
                  {r.model_url ? <span className="ml-2" title="Modèle 3D">🎬</span> : null}
                  {(() => {
                    const o = overview.get(r.id);
                    const m = missing(r, o);
                    return (
                      <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                        {m.length > 0 && (
                          <span className="rounded-full bg-brass-400/20 px-2 text-[11px] font-bold text-brass-300" title={`Manque : ${m.join(', ')}`}>
                            ⚠ {m.length}
                          </span>
                        )}
                        {o && o.open_reports > 0 && (
                          <button type="button" className="rounded-full bg-stamp/80 px-2 text-[11px] font-bold text-white" title="Signalements ouverts" onClick={() => setTab('reports')}>
                            🚩 {o.open_reports}
                          </button>
                        )}
                        {o && (o.comments > 0 || o.favorites > 0) && (
                          <span className="text-[11px] text-olive-700" title="Commentaires · favoris">
                            💬 {o.comments} ⭐ {o.favorites}
                          </span>
                        )}
                      </span>
                    );
                  })()}
                </td>
                <td className="hidden p-2 md:table-cell">{r.tags.map((t) => `#${t}`).join(' ')}</td>
                <td className="p-2">
                  {r.discovered ? (
                    <span className="font-semibold text-olive-700">Découvert</span>
                  ) : (
                    <span className="font-bold text-stamp">? Masqué</span>
                  )}
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap justify-end gap-1">
                    <button className="btn-ghost !px-3 !py-0.5" onClick={() => setDiscovered([r.id], !r.discovered)}>
                      {r.discovered ? 'Masquer' : 'Découvrir'}
                    </button>
                    <Link className="btn-ghost !px-3 !py-0.5" href={`/admin/edit/${r.category}/${pad(r.number)}`}>
                      Éditer
                    </Link>
                    <details className="relative">
                      <summary className="btn-ghost !px-3 !py-0.5 cursor-pointer list-none" aria-label="Plus d’actions">⋯</summary>
                      <div className="absolute right-0 z-20 mt-1 flex w-40 flex-col gap-1 rounded-xl border border-white/20 bg-[#0b1730] p-2 shadow-2xl">
                        <button className="btn-ghost !px-3 !py-0.5" title="Créer une copie masquée" onClick={() => duplicate(r.id)}>
                          Dupliquer
                        </button>
                        <button className="btn-danger !px-3 !py-0.5" onClick={() => removeMany([r.id])}>
                          Supprimer
                        </button>
                      </div>
                    </details>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-olive-700">
        Import JSON : liste d’objets <code>{'{ "number": 12, "title": "…", "summary", "content", "tags": [], "infobox": [{"label","value"}], "rarity": 1-8, "discovered": true }'}</code>.
        La catégorie est celle de l’onglet si elle n’est pas précisée.
      </p>
      </>
      )}
    </div>
  );
}
