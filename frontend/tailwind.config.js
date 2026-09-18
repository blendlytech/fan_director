/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Cormorant Garamond', 'serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        cream: '#FDF8F3',
        panel: '#FFFFFF',
        secondary: '#F5F0EB',
        espresso: '#302720',
        muted: '#70625C',
        divider: '#DED3CB',
        rose: {
          DEFAULT: '#E4A4BD',
          hover: '#D595AE',
          deep: '#84485D',
        },
        alert: {
          DEFAULT: '#E37A6A',
          hover: '#D66A5A',
        },
        success: '#8EB486',
        // Creator limits (design 13): "doesn't do these" is a soft rose tint,
        // "Ask Maya first" the dashboard's pending tan, softened.
        limitno: { bg: '#FAEEF2', border: '#E9C6D3' },
        limitask: { bg: '#F8EFE4', border: '#E3C8A6', ink: '#7A5530' },
        status: {
          new: '#4B9FE3',
          pending: '#D4A574',
          alert: '#E37A6A',
          approved: '#8EB486',
        },
      },
      maxWidth: {
        container: '1320px',
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        subtle: '0 8px 30px rgba(0,0,0,0.04)',
        modal: '0 20px 60px rgba(0,0,0,0.08)',
      },
      transitionDuration: {
        160: '160ms',
      },
      keyframes: {
        'bounce-in-soft': {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '50%': { transform: 'scale(1.05)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'price-flash': {
          '0%, 100%': { backgroundColor: 'transparent' },
          '50%': { backgroundColor: 'rgba(228, 164, 189, 0.3)' },
        },
        'slide-up': {
          from: { transform: 'translateY(10px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'bounce-in': 'bounce-in-soft 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'price-flash': 'price-flash 2s ease-out',
        'slide-up': 'slide-up 160ms cubic-bezier(0.4, 0, 0.2, 1) forwards',
      },
    },
  },
  plugins: [],
}
