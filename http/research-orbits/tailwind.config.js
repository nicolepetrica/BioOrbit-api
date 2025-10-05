/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // make Inter the default sans
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto",
               "Helvetica Neue", "Arial", "Noto Sans", "Apple Color Emoji",
               "Segoe UI Emoji", "Segoe UI Symbol"],
      },
    },
  },
  plugins: [],
};

// tailwind.config.js
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pumpkin: {
          DEFAULT: '#ff6d00', 100: '#331600', 200: '#662c00', 300: '#994200', 400: '#cc5800',
          500: '#ff6d00', 600: '#ff8b33', 700: '#ffa866', 800: '#ffc599', 900: '#ffe2cc'
        },
        safety_orange: {
          DEFAULT: '#ff7900', 100: '#331800', 200: '#663000', 300: '#994700', 400: '#cc5f00',
          500: '#ff7900', 600: '#ff9233', 700: '#ffad66', 800: '#ffc999', 900: '#ffe4cc'
        },
        ut_orange: {
          DEFAULT: '#ff8500', 100: '#331a00', 200: '#663500', 300: '#994f00', 400: '#cc6900',
          500: '#ff8500', 600: '#ff9c33', 700: '#ffb566', 800: '#ffce99', 900: '#ffe6cc'
        },
        princeton_orange: {
          DEFAULT: '#ff9100', 100: '#331d00', 200: '#663a00', 300: '#995700', 400: '#cc7400',
          500: '#ff9100', 600: '#ffa733', 700: '#ffbd66', 800: '#ffd399', 900: '#ffe9cc'
        },
        orange_peel: {
          DEFAULT: '#ff9e00', 100: '#331f00', 200: '#663f00', 300: '#995e00', 400: '#cc7e00',
          500: '#ff9e00', 600: '#ffb133', 700: '#ffc466', 800: '#ffd899', 900: '#ffebcc'
        },
        russian_violet: {
          DEFAULT: '#240046', 100: '#07000e', 200: '#0f001d', 300: '#16002b', 400: '#1e0039',
          500: '#240046', 600: '#52009f', 700: '#8000f7', 800: '#aa50ff', 900: '#d5a7ff'
        },
        persian_indigo: {
          DEFAULT: '#3c096c', 100: '#0c0216', 200: '#18042b', 300: '#240541', 400: '#300757',
          500: '#3c096c', 600: '#650fb5', 700: '#8d25ed', 800: '#b36ef3', 900: '#d9b6f9'
        },
        tekhelet: {
          DEFAULT: '#5a189a', 100: '#12051f', 200: '#240a3e', 300: '#360e5d', 400: '#47137c',
          500: '#5a189a', 600: '#7a21d4', 700: '#9c53e4', 800: '#bd8ced', 900: '#dec6f6'
        },
        french_violet: {
          DEFAULT: '#7b2cbf', 100: '#180926', 200: '#31114c', 300: '#491a73', 400: '#622399',
          500: '#7b2cbf', 600: '#954bd6', 700: '#b078e0', 800: '#caa5eb', 900: '#e5d2f5'
        },
        amethyst: {
          DEFAULT: '#9d4edd', 100: '#200a33', 200: '#401365', 300: '#601d98', 400: '#8127ca',
          500: '#9d4edd', 600: '#b172e4', 700: '#c596eb', 800: '#d8b9f2', 900: '#ecdcf8'
        }
      }
    }
  },
  plugins: []
}
