import type { Config } from 'tailwindcss';

// Thème « Atlas » (Lot 50) : table d'encre, chemises de cuir, laiton, sceau de cire.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#161d2b', // la table : bleu d'encre
        panel: '#1c2538', // cuir des chemises
        panel2: '#243047', // cuir relevé / survol
        paper: '#efe4c8', // texte clair couleur vélin
        accent: '#d4aa50', // laiton (titres, filets, liens) ; les fonds bg-accent sont au sceau de cire (globals.css)
        accent2: '#a83a28', // cire du sceau
        vellum: '#ece0c2',
        sepia: '#2e261d'
      },
      fontFamily: {
        display: ['"Alegreya SC"', 'Georgia', 'serif'],
        body: ['"Alegreya Sans"', 'ui-sans-serif', 'sans-serif'],
        serif: ['Alegreya', 'Georgia', 'serif']
      },
      letterSpacing: {
        widest2: '0.25em'
      }
    }
  },
  plugins: []
};
export default config;
