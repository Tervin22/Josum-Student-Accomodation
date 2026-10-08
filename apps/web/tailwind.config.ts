import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#242422',
        line: '#dedbd2',
        paper: '#f7f5ef',
        brand: '#f5b301',
        accent: '#111111',
        warn: '#b7791f',
      },
      boxShadow: {
        soft: '0 8px 24px rgba(17, 17, 17, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
