import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#070c18', // fond principal : bleu nuit
        panel: '#101a30', // panneaux / cartes
        panel2: '#18243f', // panneaux surélevés / hover
        paper: '#ece7d8', // texte clair "papier"
        accent: '#d2463b', // vermillon du sceau (éclairci pour rester lisible sur le bleu nuit)
        accent2: '#9a231b' // variante foncée (hover, bordures)
      },
      fontFamily: {
        display: ['var(--font-mono)', 'ui-monospace', 'monospace'],
        body: ['var(--font-sans)', 'ui-sans-serif', 'sans-serif']
      },
      letterSpacing: {
        widest2: '0.25em'
      }
    }
  },
  plugins: []
};
export default config;
