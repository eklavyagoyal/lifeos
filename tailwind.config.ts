/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core palette — warm, editorial, tactile
        brand: {
          50: '#fff4e6',
          100: '#ffe4c5',
          200: '#f7cfa1',
          300: '#ebb07a',
          400: '#dc9155',
          500: '#ca7337',
          600: '#ae5d2c',
          700: '#8e4923',
          800: '#713b1e',
          900: '#5c311b',
          primary: '#ae5d2c',
        },
        surface: {
          0: '#fff9f1',
          1: '#f4ecdf',
          2: '#ebdfcd',
          3: '#ddcfb8',
          4: '#c4b39b',
          hover: '#f8efe2',
          ink: '#241d18',
        },
        text: {
          primary: '#211a16',
          secondary: '#4f4035',
          tertiary: '#7a6a5b',
          muted: '#a39282',
          inverse: '#fff7ee',
        },
        accent: {
          brass: '#c0843e',
          ember: '#d8834a',
          moss: '#5f745f',
          clay: '#aa6a59',
          fog: '#ebe1d5',
          obsidian: '#2d231c',
        },
        line: {
          soft: '#d6c7b3',
          strong: '#b39b80',
          ink: '#5d4b3d',
        },
        domain: {
          health: '#6d8d6e',
          productivity: '#b86c47',
          learning: '#6676a3',
          relationships: '#b86a77',
          finance: '#c09a4a',
          creativity: '#d7864e',
          reflection: '#56847b',
        },
        status: {
          success: '#6f9a73',
          warning: '#cc984a',
          danger: '#c46b64',
          info: '#6b86b6',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', '"Inter"', '"SF Pro Display"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        display: ['"Iowan Old Style"', '"Palatino Linotype"', '"Book Antiqua"', '"Georgia"', 'serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        'display-sm': ['1.875rem', { lineHeight: '2.1rem', letterSpacing: '-0.03em' }],
        'display-md': ['2.5rem', { lineHeight: '2.75rem', letterSpacing: '-0.04em' }],
        'display-lg': ['3.5rem', { lineHeight: '3.8rem', letterSpacing: '-0.05em' }],
        eyebrow: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.18em' }],
      },
      spacing: {
        'sidebar': '18rem',
        'sidebar-collapsed': '4rem',
        stage: '5rem',
      },
      borderRadius: {
        '3xl': '1.75rem',
        '4xl': '2.25rem',
      },
      boxShadow: {
        'hairline': '0 0 0 1px rgba(93, 75, 61, 0.08)',
        'soft': '0 14px 34px -24px rgba(63, 41, 21, 0.2)',
        'panel':
          '0 28px 64px -36px rgba(58, 39, 24, 0.34), 0 1px 0 rgba(255, 250, 243, 0.9) inset, 0 0 0 1px rgba(128, 101, 73, 0.1)',
        'float':
          '0 34px 80px -40px rgba(48, 31, 19, 0.42), 0 1px 0 rgba(255, 250, 243, 0.7) inset, 0 0 0 1px rgba(98, 76, 54, 0.12)',
        'hero':
          '0 48px 110px -56px rgba(45, 31, 19, 0.52), 0 1px 0 rgba(255, 252, 247, 0.92) inset, 0 0 0 1px rgba(111, 81, 49, 0.14)',
        'inner-soft': 'inset 0 1px 0 rgba(255, 251, 245, 0.92), inset 0 -1px 0 rgba(107, 81, 54, 0.08)',
        'glow': '0 0 0 1px rgba(184, 122, 67, 0.12), 0 22px 60px -34px rgba(211, 129, 59, 0.35)',
      },
      backgroundImage: {
        'paper-wash':
          'linear-gradient(180deg, rgba(255, 249, 240, 0.95) 0%, rgba(245, 236, 223, 0.82) 100%)',
        'glass-wash':
          'linear-gradient(135deg, rgba(255, 251, 245, 0.78) 0%, rgba(242, 229, 213, 0.48) 100%)',
        'hero-glow':
          'radial-gradient(circle at top, rgba(224, 167, 111, 0.35), transparent 54%), radial-gradient(circle at 80% 20%, rgba(95, 116, 95, 0.18), transparent 42%)',
        'guide-lines':
          'linear-gradient(90deg, rgba(108, 88, 69, 0.06) 1px, transparent 1px), linear-gradient(rgba(108, 88, 69, 0.04) 1px, transparent 1px)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.2s ease-out',
        'ambient-float': 'ambientFloat 16s ease-in-out infinite',
        'ambient-drift': 'ambientDrift 24s ease-in-out infinite',
        'soft-rise': 'softRise 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)',
        'sheen': 'sheen 5.5s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        ambientFloat: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0) scale(1)' },
          '50%': { transform: 'translate3d(0, -14px, 0) scale(1.025)' },
        },
        ambientDrift: {
          '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
          '33%': { transform: 'translate3d(12px, -10px, 0)' },
          '66%': { transform: 'translate3d(-10px, 12px, 0)' },
        },
        softRise: {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.985)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        sheen: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(120%)' },
        },
      },
      transitionTimingFunction: {
        'luxury': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
