import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CATEGORY_LABELS, isCategory, pad, parseNumber, type EntryFull } from '@/lib/wiki';
import Markdown from '@/components/Markdown';
import Mention from '@/components/Mention';
import Comments from '@/components/Comments';
import EntryLink from '@/components/EntryLink';
import AccessDenied from '@/components/AccessDenied';
import Infobox from '@/components/Infobox';
import Rarity from '@/components/Rarity';
import ModelViewer from '@/components/ModelViewer';
import FavoriteButton from '@/components/FavoriteButton';
import EntryTools from '@/components/EntryTools';
import ReportButton from '@/components/ReportButton';
import PersonalNote from '@/components/PersonalNote';
import ViewTracker from '@/components/ViewTracker';

export const dynamic = 'force-dynamic';

export default async function EntryPage({ params }: { params: { category: string; number: string } }) {
  const n = parseNumber(params.number);
  if (!isCategory(params.category) || n === null) notFound();

  const supabase = createClient();
  const { data, error } = await supabase.rpc('wiki_get', { p_category: params.category, p_number: n });
  if (error) return <AccessDenied />;
  if (!data) notFound();

  const entry = data as EntryFull;
  const isAdmin = entry.id !== null;
  const label = CATEGORY_LABELS[entry.category];
  const showMasked = !entry.discovered;
  const infoRows = (entry.infobox ?? []).filter((r) => r.label);

  return (
    <article className="mx-auto max-w-3xl">
      <nav className="no-print mb-3 font-typewriter text-xs text-olive-700">
        <Link href="/" className="hover:underline">Accueil</Link> /{' '}
        <Link href={`/${entry.category}`} className="hover:underline">{label.label}</Link> / N° {pad(entry.number)}
      </nav>

      {showMasked ? (
        <div className="card p-8 text-center sm:p-10">
          <div className="text-8xl font-bold text-olive-800/50">?</div>
          <p className="mt-3 font-typewriter">
            {label.singular} N° {pad(entry.number)}
          </p>
          <span className="stamp mt-3">À découvrir en chasse !</span>
          {isAdmin && (
            <div className="mt-4">
              <Link href={`/admin/edit/${entry.category}/${pad(entry.number)}`} className="btn-ghost">
                Modifier (admin)
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">{entry.title}</h1>
              <Rarity value={entry.rarity} className="text-xl" />
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <FavoriteButton category={entry.category} number={entry.number} initial={entry.favorited} />
              <EntryTools title={entry.title ?? ''} />
              {isAdmin && (
                <Link href={`/admin/edit/${entry.category}/${pad(entry.number)}`} className="btn-ghost">
                  Modifier
                </Link>
              )}
            </div>
          </div>

          {entry.tags && entry.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {entry.tags.map((t) => (
                <Link
                  key={t}
                  href={`/${entry.category}?tag=${encodeURIComponent(t)}`}
                  className="rounded-full bg-brass-400/20 text-brass-300 px-2 py-0.5 font-typewriter text-xs hover:bg-brass-400/30"
                >
                  #{t}
                </Link>
              ))}
            </div>
          )}

          {entry.discoverer && (
            <p className="mt-3 text-sm text-olive-800">
              🏆 Découvert par <Mention nickname={entry.discoverer} />
            </p>
          )}

          {entry.summary && <p className="mt-4 text-lg italic text-olive-800">{entry.summary}</p>}

          {entry.model_url && (
            <div className="mt-4">
              <ModelViewer src={entry.model_url} animation={entry.model_animation} showAnimationPicker={false} />
            </div>
          )}

          {entry.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.image_url} alt={entry.title ?? ''} className="mt-4 max-h-96 w-full rounded-2xl border border-white/15 object-cover" />
          )}

          <div className="entry-body mt-4 flow-root">
            <Infobox rows={infoRows} />
            {entry.content && <Markdown toc>{entry.content}</Markdown>}
          </div>

          {entry.related.length > 0 && (
            <section className="mt-8 border-t border-white/15 pt-4">
              <h2 className="mb-2 font-typewriter text-lg font-bold text-olive-800">Voir aussi</h2>
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {entry.related.map((r) => (
                  <li key={`${r.category}/${r.number}`}>
                    <EntryLink category={r.category} number={r.number}>
                      {r.title ?? '?'}
                    </EntryLink>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-6">
            <ReportButton category={entry.category} number={entry.number} />
          </div>

          <PersonalNote category={entry.category} number={entry.number} />

          <ViewTracker category={entry.category} number={entry.number} title={entry.title ?? ''} />

          <Comments category={entry.category} number={entry.number} />
        </div>
      )}

      <div className="no-print mt-4 flex justify-between gap-2 font-typewriter text-sm">
        {entry.prev !== null ? (
          <Link href={`/${entry.category}/${pad(entry.prev)}`} className="btn-ghost">
            ← N° {pad(entry.prev)}
          </Link>
        ) : (
          <span />
        )}
        {entry.next !== null ? (
          <Link href={`/${entry.category}/${pad(entry.next)}`} className="btn-ghost">
            N° {pad(entry.next)} →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </article>
  );
}
