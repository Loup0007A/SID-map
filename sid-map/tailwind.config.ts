import type { Config } from 'tailwindcss';

// Thème « Atlas terre cuite » (Lot 92) : couleurs lues dans fonds.css (voir globals.css).
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Lot 92 : couleurs du thème (fonds.css). paper et accent changent
        // selon l'endroit : clairs sur le fond et le cuir, foncés sur le vélin.
        ink: 'rgb(var(--encre) / <alpha-value>)',
        panel: 'rgb(var(--encre) / <alpha-value>)',
        panel2: 'rgb(var(--encre) / <alpha-value>)',
        paper: 'rgb(var(--t-paper) / <alpha-value>)',
        accent: 'rgb(var(--t-accent) / <alpha-value>)',
        accent2: 'rgb(var(--accent) / <alpha-value>)',
        vellum: 'rgb(var(--creme) / <alpha-value>)',
        sepia: 'rgb(var(--encre) / <alpha-value>)',
        encre: 'rgb(var(--encre) / <alpha-value>)',
        creme: 'rgb(var(--creme) / <alpha-value>)',
        fond: 'rgb(var(--fond) / <alpha-value>)',
        turquoise: 'rgb(var(--accent) / <alpha-value>)',
        or: 'rgb(var(--accent-2) / <alpha-value>)'
      },
      // Lisibilité (Lot 95) : un texte « paper » estompé (text-paper/65…)
      // garde au moins 80 % d'opacité (4,5:1) ; fonds et bordures inchangés.
      textColor: {
        paper: 'rgb(var(--t-paper) / calc(0.8 + <alpha-value> * 0.2))'
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
