/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0a0a0f',
          1: '#12121a',
          2: '#1a1a25',
          3: '#222230',
        },
        accent: {
          DEFAULT: '#6c5ce7',
          light: '#a29bfe',
          dim: '#4a3fb5',
        },
        success: '#00b894',
        warning: '#fdcb6e',
        danger: '#e17055',
      },
    },
  },
  plugins: [],
}
