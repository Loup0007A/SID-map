import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12141b', // fond principal, proche du theme-color #1b1e27 du site 1
        panel: '#1b1e27', // panneaux / cartes
        panel2: '#242835', // panneaux surélevés / hover
        paper: '#e7e5db', // texte clair "papier"
        accent: '#b3261e', // rouge tampon officiel
        accent2: '#8a1c16' // variante foncée (hover, bordures)
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
