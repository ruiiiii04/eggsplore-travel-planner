// src/styles/theme.ts
export const eggsploreTheme = {
  colors: {
    primary: {
      50: '#FBF8FD',
      100: '#F4ECFA',
      200: '#E8D8F5',
      300: '#D2B5E9',
      400: '#B688DA',
      500: '#9561C8',
      600: '#7E49C2',
      700: '#6935A5',
      800: '#522879',
      900: '#3D174F',
    },

    surface: {
      background: '#FBF9FF',
      card: '#FFFFFF',
      muted: '#F2ECFA',
      border: '#D8C1F0',
      lavender: '#F4EEFC',
      lavenderDark: '#E9DDF8',
      pink: '#F8D4D6',
    },

    text: {
      primary: '#3D174F',
      secondary: '#817493',
      muted: '#A79CAF',
      accent: '#7E49C2',
      onPrimary: '#FFFFFF',
    },

    status: {
      live: '#10B981',
      delay: '#F59E0B',
      error: '#EF4444',
    },
  },

  borderRadius: {
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    '2xl': '2rem',
    full: '9999px',
  },

  shadows: {
    button: '0 5px 12px rgba(126, 73, 194, 0.25)',
    card: '0 8px 24px rgba(61, 23, 79, 0.08)',
    sheet: '0 -8px 30px rgba(61, 23, 79, 0.12)',
  },
} as const;

export type Theme = typeof eggsploreTheme;