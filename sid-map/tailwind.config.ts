import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#151312',
        parchment: '#f4ecd8',
        gold: '#b08d57'
      },
      fontFamily: {
        display: ['Cinzel', 'serif'],
        body: ['Inter', 'sans-serif']
      }
    }
  },
  plugins: []
};
export default config;
