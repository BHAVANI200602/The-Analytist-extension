/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: '#0D0D0D',
          900: '#111111',
          850: '#171717',
          800: '#1C1C1C',
          750: '#212121',
          700: '#2A2A2A',
          600: '#333333',
          500: '#4A4A4A',
          400: '#9E9E9E',
          300: '#BDBDBD',
          200: '#D9D9D9',
          100: '#ECECF1',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        premium: '0 8px 32px rgba(0, 0, 0, 0.6)',
      },
      animation: {
        'spin-slow': 'spin 5s linear infinite',
        'fadeIn': 'fadeIn 0.2s ease-out forwards',
      },
      keyframes: {
        bounceDot: {
          '0%, 80%, 100%': { transform: 'scale(0)' },
          '40%': { transform: 'scale(1)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(5px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
