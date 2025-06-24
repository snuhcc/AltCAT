/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx}", // Next.js의 App Directory용
    "./src/app/components/**/*.{js,ts,jsx,tsx}",
    "./src/app/components/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'Arial', 'sans-serif'], // 기본 Sans 계열 글꼴을 Poppins로 변경
      },
    },
  },
  plugins: [require('tailwind-scrollbar')],
};