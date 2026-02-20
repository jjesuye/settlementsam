import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Settlement Sam brand palette — warm cream / forest green / amber
        'ss-bg':      '#FDF6E9',   // warm cream background
        'ss-card':    '#FFFFFF',   // white card surfaces
        'ss-coral':   '#E8A838',   // primary CTA amber/gold
        'ss-amber':   '#4A7C59',   // forest green accent
        'ss-gold':    '#E8A838',   // same amber as primary
        'ss-text':    '#2C3E35',   // deep warm green text
        'ss-muted':   '#6B7C74',   // muted green-gray
        'ss-border':  '#E8DCC8',   // warm beige border
        'ss-overlay': 'rgba(44,62,53,0.75)',
        // New extended palette
        'ss-primary':    '#E8A838',
        'ss-secondary':  '#4A7C59',
        'ss-accent':     '#D4922A',
        'ss-success':    '#4A7C59',
        'ss-danger':     '#C0392B',
        'ss-shadow':     'rgba(44,62,53,0.08)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'ss': '16px',
        'ss-lg': '24px',
      },
      boxShadow: {
        'ss-card': '0 4px 24px rgba(44,62,53,0.10)',
        'ss-glow': '0 0 32px rgba(232,168,56,0.25)',
        'ss-green-glow': '0 0 32px rgba(74,124,89,0.20)',
      },
      animation: {
        'pulse-once': 'pulseOnce 1.4s ease-out forwards',
        'fade-up': 'fadeUp 0.4s ease-out forwards',
        'glow-in': 'glowIn 0.6s ease-out forwards',
      },
      keyframes: {
        pulseOnce: {
          '0%':   { transform: 'scale(1)',    boxShadow: '0 0 0 0 rgba(232,168,56,0.5)' },
          '50%':  { transform: 'scale(1.04)', boxShadow: '0 0 0 12px rgba(232,168,56,0)' },
          '100%': { transform: 'scale(1)',    boxShadow: '0 0 0 0 rgba(232,168,56,0)' },
        },
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowIn: {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
