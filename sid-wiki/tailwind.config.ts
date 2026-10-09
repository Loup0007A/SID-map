import type { Config } from 'tailwindcss';
import typography from '@tailwindcss/typography';

// Thème sombre : les noms de tokens historiques sont conservés mais inversés.
//   ink / olive-* = textes clairs (bleu glacier)   kraft = bleus d'accent
//   brass = jaune soleil                           stamp = corail   night = texte foncé (sur jaune)
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        kraft: {
          50: '#f4fbff',
          100: '#e3f4ff',
          200: '#c9e9fb',
          300: '#a5d8f5',
          400: '#7cc3ee',
          500: '#4fa8e0',
        },
        olive: {
          600: '#6fb8f2',
          700: '#8cc9ff',
          800: '#c5e3ff',
          900: '#e3f3ff',
        },
        brass: {
          300: '#ffe08a',
          400: '#ffcb45',
          500: '#f5a623',
          600: '#d98614',
        },
        ink: '#e8f3ff',
        night: '#0b1a33',
        stamp: '#ff6b5b',
      },
      fontFamily: {
        typewriter: ['"Baloo 2"', 'system-ui', 'sans-serif'],
        body: ['Nunito', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [typography],
};

export default config;
