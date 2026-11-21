// En-têtes de sécurité : en-tetes-securite.js (identique sur les trois sites).
const { SECURITY_HEADERS } = require('./en-tetes-securite');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Aucune page n'utilise next/image : l'optimiseur d'images de Next est coupé
  // (/_next/image répond 404), ce qui écarte ses failles connues.
  images: { unoptimized: true },
  async headers() {
    return [
      { source: '/:path*', headers: SECURITY_HEADERS },
      // Service worker (Carto hors ligne) : toujours revérifié.
      { source: '/sw-carto.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
  webpack: (config) => {
    // Lot 77 : le JSX passe par src/brand (tsconfig jsxImportSource). Le cache
    // de compilation gardé d'un build à l'autre (Vercel compris) ne doit pas
    // resservir les modules compilés avant ce changement.
    if (config.cache && typeof config.cache === 'object') {
      config.cache.version = `${config.cache.version || ''}|jsx-brand-1`;
    }
    return config;
  },
};
module.exports = nextConfig;
