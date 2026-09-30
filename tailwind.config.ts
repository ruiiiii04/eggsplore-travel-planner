// tailwind.config.ts
import type { Config } from 'tailwindcss';
import { eggsploreTheme } from './src/styles/theme';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/features/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],

  theme: {
    extend: {
      colors: eggsploreTheme.colors,

      borderRadius: eggsploreTheme.borderRadius,

      boxShadow: {
        button: eggsploreTheme.shadows.button,
        soft: eggsploreTheme.shadows.button,
        card: eggsploreTheme.shadows.card,
        sheet: eggsploreTheme.shadows.sheet,
      },
    },
  },

  plugins: [],
};

export default config;