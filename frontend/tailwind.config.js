/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Formalizes the violet accent already used ad hoc alongside primary
        // in gradients (Landing hero, CTA buttons) into a real token so it's
        // consistent across pages instead of one-off `purple-600` literals.
        accent: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        surface: {
          DEFAULT: '#ffffff',
          50: '#f8f8fc',
          100: '#f0f0f8',
          200: '#e8e8f4',
        },
        muted: '#6b7280',
      },
      boxShadow: {
        // Elevation scale layered on top of Tailwind's defaults — used by the
        // shared .card/.btn-primary component classes in index.css so every
        // page picks up the same depth language automatically.
        soft: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.05)',
        elevated: '0 4px 6px -2px rgba(15, 23, 42, 0.04), 0 12px 20px -6px rgba(15, 23, 42, 0.08)',
        floating: '0 24px 48px -16px rgba(79, 70, 229, 0.20), 0 8px 20px -8px rgba(15, 23, 42, 0.10)',
        glow: '0 0 0 1px rgba(99, 102, 241, 0.06), 0 12px 28px -6px rgba(99, 102, 241, 0.35)',
      },
      backgroundImage: {
        'grid-fade': 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.9))',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 1.5s infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'stream': 'stream 0.1s ease-out',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        stream: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
