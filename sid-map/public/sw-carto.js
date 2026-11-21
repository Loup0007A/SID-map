/*
 * Service worker de la Cartographie (Lot 96) : la carte s'ouvre sans réseau.
 *
 *  - pages (/carte, /ville/…, /batiment/…, /lieu/…) : réseau d'abord ; sans
 *    réseau, la dernière version vue ;
 *  - JavaScript et CSS de Next (/_next/static) : jamais modifiés une fois
 *    publiés, gardés tels quels ;
 *  - images, polices, icônes (du site et du stockage Supabase public) :
 *    copie servie tout de suite, remise à jour en arrière-plan.
 * Les données (lieux, routes, météo…) sont gardées par la page elle-même
 * (src/lib/horsLigne.ts). Rien n'est gardé pour /login ni pour l'API.
 */
const VERSION = "carto-v1";
const PAGES = `${VERSION}-pages`;
const STATIQUE = `${VERSION}-statique`;
const IMAGES = `${VERSION}-images`;
const PAGES_GARDEES = /^\/(carte|ville\/|batiment\/|lieu\/)/;
const MAX_IMAGES = 400;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith("carto-") && !k.startsWith(VERSION)) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "vider") {
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(IMAGES)]));
  }
});

async function reseauDabord(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    // Seulement une vraie page (pas une redirection vers /login).
    if (res.ok && res.type === "basic" && !res.redirected) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const url = new URL(request.url);
    const copie = (await cache.match(request, { ignoreSearch: false })) || (await cache.match(url.pathname)) || (url.pathname.startsWith("/carte") ? await cache.match("/carte") : undefined);
    if (copie) return copie;
    throw err;
  }
}

async function cacheDabord(request) {
  const cache = await caches.open(STATIQUE);
  const copie = await cache.match(request);
  if (copie) return copie;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function copiePuisMaj(request) {
  const cache = await caches.open(IMAGES);
  const copie = await cache.match(request);
  const maj = fetch(request)
    .then(async (res) => {
      if (res.ok || res.type === "opaque") {
        await cache.put(request, res.clone());
        const cles = await cache.keys();
        for (const k of cles.slice(0, Math.max(0, cles.length - MAX_IMAGES))) await cache.delete(k);
      }
      return res;
    })
    .catch(() => copie);
  return copie || maj;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  const ici = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    if (ici && PAGES_GARDEES.test(url.pathname)) event.respondWith(reseauDabord(request));
    return;
  }
  if (ici && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheDabord(request));
    return;
  }
  if (ici && /\.(png|jpe?g|webp|svg|gif|ico|woff2?|glb)$/.test(url.pathname)) {
    event.respondWith(copiePuisMaj(request));
    return;
  }
  if (!ici && url.pathname.includes("/storage/v1/object/public/")) {
    event.respondWith(copiePuisMaj(request));
  }
});
