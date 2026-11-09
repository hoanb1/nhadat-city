import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          dark: '#1d4ed8',
        },
        accent: '#ef4444',
        text: {
          DEFAULT: '#1e293b',
          secondary: '#64748b',
          muted: '#94a3b8',
        },
        bg: '#f8fafc',
        surface: '#ffffff',
        border: '#e2e8f0',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04)',
        md: '0 4px 12px rgba(0,0,0,.08)',
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '16px',
      },
    },
  },
  plugins: [],
};

export default config;
