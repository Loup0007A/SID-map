import Link from 'next/link';
import { pad, type EntrySummary } from '@/lib/wiki';
import Rarity from './Rarity';
import Icon from './Icon';

export default function EntryCard({ entry, showCategory = false }: { entry: EntrySummary; showCategory?: boolean }) {
  const known = entry.title !== null;
  const hidden = !entry.discovered;

  return (
    <Link
      href={`/${entry.category}/${pad(entry.number)}`}
      className={`card block p-2.5 transition sm:p-3 hover:-translate-y-0.5 hover:border-brass-500 ${hidden ? 'bg-white/[0.04]' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-typewriter text-xs text-olive-700">
          {showCategory && <Icon name={entry.category} className="mr-1" />}N° {pad(entry.number)}
        </span>
        {entry.has_model && (
          <span className="rounded-full bg-kraft-500/30 px-2 text-[10px] font-bold text-olive-800" title="Modèle 3D animé">
            🎬 3D
          </span>
        )}
      </div>

      {known ? (
        <>
          {entry.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.image_url} alt="" className="mt-2 h-24 w-full sm:h-28 rounded-lg border border-white/15 object-cover" />
          )}
          <h3 className="mt-2 font-bold">{entry.title}</h3>
          <Rarity value={entry.rarity} className="text-sm" />
          {entry.summary && <p className="line-clamp-2 text-sm text-olive-800">{entry.summary}</p>}
          {entry.tags && entry.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {entry.tags.map((t) => (
                <span key={t} className="rounded-full bg-brass-400/20 text-brass-300 px-2 py-0.5 font-typewriter text-[10px]">
                  {t}
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex h-24 items-center justify-center text-6xl font-extrabold text-olive-700/40">?</div>
      )}
    </Link>
  );
}
