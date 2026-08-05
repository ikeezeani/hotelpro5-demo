/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0F1B1A',
          900: '#152524',
          800: '#1E332F',
          700: '#2A443E',
          600: '#3A5C52'
        },
        brass: {
          400: '#D4A855',
          500: '#C08F3E',
          600: '#A5762E'
        },
        linen: {
          50: '#FAF7F0',
          100: '#F3EEE1',
          200: '#E7DFC9'
        }
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Inter"', 'sans-serif']
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15,27,26,0.06), 0 8px 24px -12px rgba(15,27,26,0.25)'
      }
    }
  },
  plugins: []
};
