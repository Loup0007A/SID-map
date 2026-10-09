'use client';

import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import EntryLink from './EntryLink';
import Mention from './Mention';
import { ENTRY_HREF_RE, extractHeadings, isCategory, preprocessMentions, preprocessWikiLinks } from '@/lib/wiki';

/**
 * Rendu markdown sûr (pas de HTML brut).
 * - [[armes/012]] / [[armes/012|texte]] : lien vers une fiche, avec aperçu au survol
 * - @pseudo : pastille de mention
 * - Titres numérotés avec ancres ; `toc` affiche un sommaire à la Wikipédia (dès 3 titres)
 */
export default function Markdown({ children, toc = false }: { children: string; toc?: boolean }) {
  const headings = useMemo(() => extractHeadings(children), [children]);
  const source = useMemo(() => preprocessMentions(preprocessWikiLinks(children)), [children]);

  const byLine = new Map(headings.map((h) => [h.line, h]));
  const heading =
    (tag: 'h2' | 'h3') =>
    // eslint-disable-next-line react/display-name
    ({ node, children }: { node?: { position?: { start: { line: number } } }; children?: React.ReactNode }) => {
      const h = node?.position ? byLine.get(node.position.start.line) : undefined;
      const Tag = tag;
      if (!h) return <Tag>{children}</Tag>;
      return (
        <Tag
          id={h.slug}
          className={`group flow-root scroll-mt-24 font-typewriter text-olive-800 ${
            tag === 'h2' ? 'border-b border-olive-800/30 pb-1' : ''
          }`}
        >
          <span className="mr-2 text-olive-600/70">{h.number}</span>
          {children}
          <a href={`#${h.slug}`} className="ml-2 text-sm text-olive-600 no-underline opacity-0 transition group-hover:opacity-100" aria-label="Lien vers cette section">
            #
          </a>
        </Tag>
      );
    };

  const H2 = heading('h2');
  const H3 = heading('h3');

  return (
    <div className="prose prose-invert max-w-none prose-a:font-semibold prose-a:text-olive-700 prose-a:no-underline">
      {toc && headings.length >= 3 && (
        <details open className="not-prose float-none mb-5 block w-full rounded-xl border border-white/15 bg-white/[0.09] p-3 backdrop-blur sm:float-right sm:clear-right sm:ml-5 sm:inline-block sm:w-auto sm:min-w-[16rem]">
          <summary className="cursor-pointer select-none text-center font-typewriter font-bold text-olive-800">Sommaire</summary>
          <ol className="mt-2 space-y-0.5 text-sm">
            {headings.map((h) => (
              <li key={h.slug} className={h.level === 2 ? 'ml-4' : ''}>
                <a href={`#${h.slug}`} className="text-olive-700 no-underline hover:text-stamp">
                  <span className="mr-1.5 text-olive-600/70">{h.number}</span>
                  {h.text}
                </a>
              </li>
            ))}
          </ol>
        </details>
      )}

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="not-prose my-4 overflow-x-auto rounded-xl border border-white/15 bg-white/[0.07]">
              <table className="w-full min-w-[20rem] text-left text-sm [&_td]:border-t [&_td]:border-white/15 [&_td]:p-2 [&_th]:whitespace-nowrap [&_th]:bg-white/[0.1] [&_th]:p-2 [&_th]:font-typewriter">{children}</table>
            </div>
          ),
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={typeof src === 'string' ? src : undefined} alt={alt ?? ''} className="h-auto max-w-full rounded-xl" loading="lazy" />
          ),
          h1: H2,
          h2: H2,
          h3: H3,
          a({ href, children }) {
            const mention = href?.match(/^\/mention\/(.+)$/);
            if (mention) return <Mention nickname={decodeURIComponent(mention[1])} />;

            const m = href?.match(ENTRY_HREF_RE);
            if (m && isCategory(m[1])) {
              return (
                <EntryLink category={m[1]} number={parseInt(m[2], 10)}>
                  {children}
                </EntryLink>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="wiki-link">
                {children}
              </a>
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
      <div className="clear-both" />
    </div>
  );
}
