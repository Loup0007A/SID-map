import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/lib/wiki';
import Icon from '@/components/Icon';
import AccessDenied from '@/components/AccessDenied';

export const dynamic = 'force-dynamic';

export default async function TagsPage() {
  const { data, error } = await createClient().rpc('wiki_all_tags');
  if (error) return <AccessDenied />;
  const rows = (data ?? []) as { category: Category; tag: string; total: number }[];

  return (
    <div>
      <h1 className="title-grad mb-1 font-typewriter text-2xl font-bold text-olive-800 sm:text-3xl"><Icon name="tags" /> Tous les tags</h1>
      <p className="mb-6 text-olive-700">Clique sur un tag pour voir toutes les fiches découvertes qui le portent.</p>

      {rows.length === 0 ? (
        <p className="italic text-olive-700">Aucun tag pour l’instant.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {CATEGORIES.map((c) => {
            const list = rows.filter((r) => r.category === c);
            if (list.length === 0) return null;
            return (
              <section key={c} className="card p-4">
                <h2 className="mb-3 font-typewriter text-lg font-bold text-olive-800">
                  <Icon name={c} /> {CATEGORY_LABELS[c].label}
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {list.map((r) => (
                    <Link
                      key={r.tag}
                      href={`/${c}?tag=${encodeURIComponent(r.tag)}`}
                      className="rounded-full bg-brass-400/20 px-3 py-1 font-typewriter text-sm text-brass-300 hover:bg-brass-400/30"
                    >
                      #{r.tag} <span className="text-xs opacity-70">{r.total}</span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
