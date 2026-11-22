/**
 * Carto hors ligne (Lot 96) : la dernière copie des données lues.
 *
 * Le client Supabase passe par fetchHorsLigne. Chaque lecture réussie
 * (tables, et les fonctions de lecture listées dans LECTURES) est gardée
 * dans le cache du navigateur, au nom du membre connecté. Sans réseau, la
 * même lecture renvoie la dernière copie et la page affiche « Hors ligne :
 * données du … ». Les écritures (trajets, achats…) échouent comme avant.
 *
 * La page elle-même (HTML, JavaScript, images) est gardée par le service
 * worker public/sw-carto.js. Tout est effacé à la déconnexion.
 */

const CACHE = "sid-carto-donnees-v1";
export const HORS_LIGNE_EVENT = "sid:hors-ligne";
const SAVED_AT = "x-sid-enregistre";

/** Fonctions sans effet (lectures) dont la réponse peut être resservie hors ligne. */
const LECTURES = new Set([
  "get_world_map",
  "carnet",
  "mes_epingles",
  "get_city_plan",
  "get_building_detail",
  "map_weather_now",
  "map_incursion_current",
  "exploration_state",
  "exploration_leaderboard",
  "list_active_positions",
  "list_map_quests",
  "list_map_comments",
  "list_groups_for_map",
  "list_roster",
  "place_wiki_entries",
  "quest_participant_counts",
  "glitched_members",
  "site_decor",
  "public_config",
  "election_status",
  "has_permission",
]);

export type EtatHorsLigne = { horsLigne: boolean; date: number | null };

function sujet(headers: Headers): string | null {
  const tok = (headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  try {
    const p = JSON.parse(atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof p.sub === "string" ? p.sub : null;
  } catch {
    return null;
  }
}

async function cle(uid: string, method: string, url: string, body: string): Promise<string> {
  const data = new TextEncoder().encode(`${uid}\n${method}\n${url}\n${body}`);
  const h = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
  return `https://hors-ligne.invalid/${hex}`;
}

function gardable(method: string, url: URL): boolean {
  if (!url.pathname.startsWith("/rest/v1/")) return false;
  if (method === "GET") return true;
  if (method !== "POST") return false;
  const m = url.pathname.match(/^\/rest\/v1\/rpc\/([a-z0-9_]+)$/);
  return !!m && LECTURES.has(m[1]);
}

function signaler(etat: EtatHorsLigne) {
  try {
    window.dispatchEvent(new CustomEvent<EtatHorsLigne>(HORS_LIGNE_EVENT, { detail: etat }));
  } catch {
    /* hors navigateur */
  }
}

/** fetch du client Supabase : garde les lectures, les resservent sans réseau. */
export function fetchHorsLigne(base: typeof fetch): typeof fetch {
  return async (input, init) => {
    if (typeof window === "undefined" || typeof caches === "undefined") return base(input, init);
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    let url: URL;
    try {
      url = new URL(href, location.href);
    } catch {
      return base(input, init);
    }
    if (!gardable(method, url)) return base(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const uid = sujet(headers);
    const body = typeof init?.body === "string" ? init.body : "";
    if (!uid || (init?.body != null && typeof init.body !== "string")) return base(input, init);
    const k = await cle(uid, method, url.href, body);

    try {
      const res = await base(input, init);
      if (res.ok) {
        const copie = res.clone();
        copie
          .text()
          .then(async (texte) => {
            const h = new Headers({ "content-type": copie.headers.get("content-type") ?? "application/json", [SAVED_AT]: String(Date.now()) });
            const range = copie.headers.get("content-range");
            if (range) h.set("content-range", range);
            await (await caches.open(CACHE)).put(k, new Response(texte, { status: copie.status, headers: h }));
          })
          .catch(() => undefined);
        signaler({ horsLigne: false, date: null });
      }
      return res;
    } catch (err) {
      // Réseau coupé (pas une erreur de la base) : la dernière copie.
      const vieux = await (await caches.open(CACHE)).match(k).catch(() => undefined);
      if (!vieux) throw err;
      signaler({ horsLigne: true, date: Number(vieux.headers.get(SAVED_AT)) || null });
      return vieux;
    }
  };
}

/** À la déconnexion : plus rien du membre dans ce navigateur. */
export async function viderHorsLigne() {
  try {
    await caches.delete(CACHE);
    const reg = await navigator.serviceWorker?.getRegistration("/");
    reg?.active?.postMessage({ type: "vider" });
  } catch {
    /* cache indisponible */
  }
}
