import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { pad, type Category, type EntrySummary } from '@/lib/wiki';
import EntryCard from '@/components/EntryCard';
import Icon from '@/components/Icon';
import AccessDenied from '@/components/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function FavoritesPage() {
  const supabase = createClient();
  const [{ data, error }, { data: notesData }] = await Promise.all([supabase.rpc('wiki_favorites_list'), supabase.rpc('wiki_notes_list')]);
  if (error) return <AccessDenied />;
  const notes = (notesData ?? []) as { category: Category; number: number; title: string; body: string }[];
  const entries = (data ?? []) as EntrySummary[];

  return (
    <div>
      <h1 className="title-grad mb-4 font-typewriter text-3xl font-bold text-olive-800"><Icon name="favoris" /> Mes favoris et notes</h1>
      {entries.length === 0 ? (
        <p className="italic text-olive-700">Pas encore de favori. Clique sur « ☆ Ajouter aux favoris » sur une fiche !</p>
      ) : (
        <div className="stagger grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {entries.map((e) => (
            <EntryCard key={`${e.category}${e.number}`} entry={e} showCategory />
          ))}
        </div>
      )}

      {notes.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-typewriter text-2xl font-bold text-olive-800">📝 Mes notes</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {notes.map((n) => (
              <li key={`${n.category}${n.number}`} className="card p-4">
                <Link href={`/${n.category}/${pad(n.number)}`} className="font-bold text-olive-700 hover:underline">
                  <Icon name={n.category} /> {n.title} <span className="font-typewriter text-xs">N° {pad(n.number)}</span>
                </Link>
                <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm text-olive-800">{n.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
