'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Modal from '@/components/ui/Modal';
import { usePermission } from '@/lib/hooks/usePermission';
import { openApp } from '@/lib/apps';
import {
  ADMIN_CHECKLIST,
  HELP_TOPICS,
  PLAYER_CHECKLIST,
  type Audience,
  type ChecklistItem,
  type GuideFacts
} from '@/lib/guide';

function Checklist({
  title,
  items,
  facts,
  onAction
}: {
  title: string;
  items: ChecklistItem[];
  facts: GuideFacts | null;
  onAction: (app: string) => void;
}) {
  const required = items.filter((i) => !i.optional);
  const doneCount = facts ? required.filter((i) => i.done(facts)).length : 0;
  const pct = required.length ? Math.round((doneCount / required.length) * 100) : 0;

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="font-display text-[11px] uppercase tracking-wide text-accent">{title}</h4>
        {facts && (
          <span className="text-[11px] text-paper/50">
            {doneCount}/{required.length} essentiels
          </span>
        )}
      </div>
      {facts && (
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      <ul className="space-y-1.5">
        {items.map((it) => {
          const done = facts ? it.done(facts) : false;
          return (
            <li key={it.id} className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/5 p-2.5">
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                  done ? 'border-emerald-400/60 bg-emerald-400/15 text-emerald-300' : 'border-white/25 text-transparent'
                }`}
              >
                ✓
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${done ? 'text-paper/50 line-through' : 'text-paper'}`}>
                  {it.label}
                  {it.optional && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-paper/40 no-underline">facultatif</span>}
                  <span className="sr-only">{done ? ' — fait' : ' — à faire'}</span>
                </p>
                {!done && <p className="mt-0.5 text-xs leading-relaxed text-paper/55">{it.why}</p>}
              </div>
              {!done && it.app && (
                <button
                  onClick={() => onAction(it.app!)}
                  className="shrink-0 rounded-lg border border-accent/50 px-2.5 py-1 text-xs text-accent hover:bg-accent/10"
                >
                  {it.actionLabel ?? 'Ouvrir'}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Topics({ audience }: { audience: Audience }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-1.5">
      {HELP_TOPICS.filter((t) => t.audience === audience).map((t) => (
        <div key={t.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <button
            onClick={() => setOpen(open === t.id ? null : t.id)}
            aria-expanded={open === t.id}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-paper hover:bg-white/5"
          >
            <span aria-hidden>{t.emoji}</span>
            <span className="flex-1">{t.title}</span>
            <span aria-hidden className="text-paper/40">{open === t.id ? '▴' : '▾'}</span>
          </button>
          {open === t.id && (
            <div className="space-y-2 border-t border-white/10 px-3 py-2.5">
              <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-paper/80">
                {t.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
              {t.note && <p className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-paper/60">💡 {t.note}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function HelpCenter({
  initialTab,
  facts,
  onStartTour,
  onClose
}: {
  initialTab: 'start' | 'topics';
  facts: GuideFacts | null;
  onStartTour: (kind: Audience) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { allowed: isAdmin } = usePermission('manage_map');
  const [tab, setTab] = useState(initialTab);
  const onMap = pathname === '/carte';

  function launch(app: string) {
    onClose();
    if (onMap) openApp(app);
    else router.push(`/carte?app=${app}`);
  }

  function tour(kind: Audience) {
    if (onMap) return onStartTour(kind);
    onClose();
    router.push(`/carte?visite=${kind}`);
  }

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 font-display text-[11px] uppercase tracking-wide transition ${
      active ? 'bg-accent text-paper' : 'border border-white/15 text-paper/70 hover:text-accent'
    }`;

  return (
    <Modal
      title="? Aide"
      onClose={onClose}
      maxWidth="max-w-lg"
      top={
        <div className="flex gap-1.5">
          <button onClick={() => setTab('start')} className={chip(tab === 'start')}>
            Démarrer
          </button>
          <button onClick={() => setTab('topics')} className={chip(tab === 'topics')}>
            Comment faire…
          </button>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-auto text-xs text-paper/50">Visite guidée (1 min)</span>
          <button onClick={() => tour('player')} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-paper/80 hover:border-accent hover:text-accent">
            ▶ Joueur
          </button>
          {isAdmin && (
            <button onClick={() => tour('admin')} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-paper/80 hover:border-accent hover:text-accent">
              ▶ Administration
            </button>
          )}
        </div>
      }
    >
      {tab === 'start' ? (
        <div className="space-y-5">
          {!facts && (
            <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-paper/60">
              L’avancement se calcule sur la carte du monde : ouvre-la pour voir ce qui est déjà fait.
            </p>
          )}
          <Checklist title="Ton personnage" items={PLAYER_CHECKLIST} facts={facts} onAction={launch} />
          {isAdmin && <Checklist title="Construire le monde (admin)" items={ADMIN_CHECKLIST} facts={facts} onAction={launch} />}
        </div>
      ) : (
        <div className="space-y-5">
          <section className="space-y-2">
            <h4 className="font-display text-[11px] uppercase tracking-wide text-accent">Jouer</h4>
            <Topics audience="player" />
          </section>
          {isAdmin && (
            <section className="space-y-2">
              <h4 className="font-display text-[11px] uppercase tracking-wide text-accent">Administrer</h4>
              <Topics audience="admin" />
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}
