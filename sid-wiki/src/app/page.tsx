import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { CATEGORIES, CATEGORY_LABELS, pad, type Category, type RecentEntry } from '@/lib/wiki';
import AccessDenied from '@/components/AccessDenied';
import Mention from '@/components/Mention';
import Icon from '@/components/Icon';
import WelcomeTip from '@/components/WelcomeTip';
import NewSince from '@/components/NewSince';
import RecentlyViewed from '@/components/RecentlyViewed';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const supabase = createClient();
  const [{ data, error }, { data: recentData }, { data: topData }, { data: announcement }] = await Promise.all([
    supabase.rpc('wiki_stats'),
    supabase.rpc('wiki_recent', { p_limit: 6 }),
    supabase.rpc('wiki_top_discoverers', { p_limit: 5 }),
    supabase.rpc('wiki_announcement_get'),
  ]);
  if (error) return <AccessDenied />;

  const stats = new Map<string, { total: number; found: number }>();
  for (const r of (data ?? []) as { category: string; total: number; discovered_count: number }[]) {
    stats.set(r.category, { total: r.total, found: r.discovered_count });
  }
  const recent = (recentData ?? []) as RecentEntry[];
  const top = (topData ?? []) as { nickname: string; total: number }[];

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="title-grad font-typewriter text-2xl font-bold text-olive-800 sm:text-3xl">Bienvenue, chasseur !</h1>
      </div>
      {typeof announcement === 'string' && announcement.trim() && (
        <div className="mb-4 mt-3 rounded-2xl border border-brass-400/40 bg-brass-400/15 px-4 py-3 text-brass-300">
          <span className="mr-2">📣</span>
          <span className="whitespace-pre-line font-semibold">{announcement}</span>
        </div>
      )}
      <WelcomeTip />
      <NewSince dates={recent.map((r) => r.discovered_at)} />
      <p className="mb-6 text-olive-700">Retrouve ici tout ce que la S.I.D. a déjà croisé en chasse. Le reste ? Il reste à découvrir !</p>

      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {CATEGORIES.map((c: Category) => {
          const s = stats.get(c) ?? { total: 0, found: 0 };
          const pct = s.total ? Math.round((s.found / s.total) * 100) : 0;
          return (
            <Link key={c} href={`/${c}`} className="card p-4 transition hover:-translate-y-0.5 hover:border-brass-500 sm:p-5">
              <div className="text-3xl"><Icon name={c} /></div>
              <h2 className="mt-2 font-typewriter text-xl font-bold">{CATEGORY_LABELS[c].label}</h2>
              <p className="text-sm text-olive-700">
                {s.found} / {s.total} découvert{s.found > 1 ? 's' : ''}
              </p>
              <div className="mt-2 h-2 rounded-full bg-white/[0.1]">
                <div className="h-2 rounded-full bg-gradient-to-r from-brass-400 to-brass-500" style={{ width: `${pct}%` }} />
              </div>
            </Link>
          );
        })}
      </div>

      <RecentlyViewed />

      <div className="mt-4 grid gap-4 lg:grid-cols-3 lg:items-start">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-typewriter text-xl font-bold text-olive-800">🆕 Dernières découvertes</h2>
          {recent.length === 0 ? (
            <p className="italic text-olive-700">Rien de découvert pour l’instant. À vos armes !</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {recent.map((r) => (
                <li key={`${r.category}${r.number}`} className="flex items-center gap-3 py-2">
                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt="" className="h-10 w-10 flex-none rounded-lg border border-white/15 object-cover" />
                  ) : (
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-white/[0.1] text-xl">
                      <Icon name={r.category} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link href={`/${r.category}/${pad(r.number)}`} className="font-bold text-olive-700 hover:underline">
                      {r.title}
                    </Link>
                    <div className="text-xs text-olive-700/80">
                      {CATEGORY_LABELS[r.category].label} · N° {pad(r.number)}
                      {r.discovered_at && ` · ${new Date(r.discovered_at).toLocaleDateString('fr-FR')}`}
                    </div>
                  </div>
                  {r.discoverer && <Mention nickname={r.discoverer} />}
                </li>
              ))}
            </ul>
          )}
        </section>

        <details className="card p-5">
          <summary className="cursor-pointer select-none font-typewriter text-xl font-bold text-olive-800">🏆 Top découvreurs</summary>
          <div className="mt-3">
          {top.length === 0 ? (
            <p className="italic text-olive-700">Personne n’a encore été crédité.</p>
          ) : (
            <ol className="space-y-2">
              {top.map((t, i) => (
                <li key={t.nickname} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="mr-2 font-typewriter font-bold text-olive-600/70">{['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`}</span>
                    <Mention nickname={t.nickname} />
                  </span>
                  <span className="font-typewriter font-bold">{t.total}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        </details>
      </div>
    </div>
  );
}
