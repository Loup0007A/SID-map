export const CATEGORIES = ['lieux', 'armes', 'mobs', 'objets', 'skills'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, { label: string; singular: string; icon: string }> = {
  lieux: { label: 'Lieux', singular: 'Lieu', icon: '🗺' },
  armes: { label: 'Armes', singular: 'Arme', icon: '⚔' },
  mobs: { label: 'Mobs', singular: 'Mob', icon: '☠' },
  objets: { label: 'Objets', singular: 'Objet', icon: '🎒' },
  skills: { label: 'Skills', singular: 'Skill', icon: '✨' },
};

/** Regex d'un lien interne /categorie/NNN */
export const ENTRY_HREF_RE = new RegExp(`^/(${CATEGORIES.join('|')})/(\\d{1,3})$`);

export type InfoRow = { label: string; value: string };

export function isCategory(v: string): v is Category {
  return (CATEGORIES as readonly string[]).includes(v);
}

export function parseNumber(v: string): number | null {
  if (!/^\d{1,3}$/.test(v)) return null;
  return parseInt(v, 10);
}

export function pad(n: number): string {
  return String(n).padStart(3, '0');
}

export type EntrySummary = {
  category: Category;
  number: number;
  discovered: boolean;
  title: string | null;
  summary: string | null;
  image_url: string | null;
  tags: string[] | null;
  rarity: number | null;
  has_model: boolean;
};

export type RecentEntry = {
  category: Category;
  number: number;
  title: string;
  image_url: string | null;
  discovered_at: string | null;
  discoverer: string | null;
};

export type RelatedEntry = {
  category: Category;
  number: number;
  discovered: boolean;
  title: string | null;
};

export type EntryFull = {
  id: string | null;
  category: Category;
  number: number;
  discovered: boolean;
  title: string | null;
  summary: string | null;
  content: string | null;
  image_url: string | null;
  tags: string[] | null;
  updated_at: string | null;
  discoverer: string | null;
  infobox: InfoRow[] | null;
  rarity: number | null;
  model_url: string | null;
  model_animation: string | null;
  favorited: boolean;
  prev: number | null;
  next: number | null;
  related: RelatedEntry[];
};

export type WikiComment = {
  id: string;
  author_id: string;
  author_nickname: string;
  body: string;
  created_at: string;
  can_delete: boolean;
};

export type Heading = { level: 1 | 2; text: string; slug: string; number: string; line: number };

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'section'
  );
}

/**
 * Titres du contenu, à la Wikipédia : `#` et `##` = section (1, 2…), `###` = sous-section (1.1, 1.2…).
 * Les blocs de code sont ignorés. Les slugs sont uniques (-2, -3…).
 */
export function extractHeadings(md: string): Heading[] {
  const out: Heading[] = [];
  const used = new Map<string, number>();
  let inFence = false;
  let a = 0;
  let b = 0;

  const lines = md.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = line.match(/^(#{1,3})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;

    const level: 1 | 2 = m[1].length === 3 ? 2 : 1;
    const text = m[2].replace(/[*_`]|\[([^\]]*)\]\([^)]*\)/g, '$1').trim();
    let number: string;
    if (level === 1) {
      a += 1;
      b = 0;
      number = String(a);
    } else {
      if (a === 0) a = 1;
      b += 1;
      number = `${a}.${b}`;
    }
    const base = slugify(text);
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    out.push({ level, text, slug: n === 1 ? base : `${base}-${n}`, number, line: i + 1 });
  }
  return out;
}

/** `@pseudo` → lien interne /mention/pseudo (rendu en pastille). Le code est ignoré. */
export function preprocessMentions(md: string): string {
  return md
    .split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]+`)/g)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(
            /(^|[^\p{L}\p{N}_@/\\])@([\p{L}\p{N}_](?:[\p{L}\p{N}_.-]{0,30}[\p{L}\p{N}_])?)/gu,
            (_m, pre: string, nick: string) =>
              `${pre}[@${nick.replace(/_/g, '\\_')}](/mention/${encodeURIComponent(nick)})`
          )
    )
    .join('');
}

/**
 * Syntaxe wiki : [[armes/012]] ou [[armes/012|texte affiché]]
 * Convertie en lien markdown interne, ensuite rendu avec aperçu au survol.
 */
export function preprocessWikiLinks(md: string): string {
  return md.replace(
    new RegExp(`\\[\\[(${CATEGORIES.join('|')})/(\\d{1,3})(?:\\|([^\\]]+))?\\]\\]`, 'g'),
    (_m, cat: string, num: string, label?: string) =>
      `[${label ?? `${cat}/${pad(parseInt(num, 10))}`}](/${cat}/${pad(parseInt(num, 10))})`
  );
}
