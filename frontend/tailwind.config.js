/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Dette setter Inter som standardfont for 'font-sans' klassen (som er default i Tailwind)
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      zIndex: {
        1000: '1000',
        1001: '1001',
        1500: '1500',
        2000: '2000',
        3000: '3000',
        9999: '9999',
      },
    },
  },
  plugins: [],
}
