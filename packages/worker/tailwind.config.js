module.exports = {
  content: ["./src/landing.ts", "./src/guide_page.ts"],
  theme: {
    extend: {
      colors: {
        neutral: {
          50: '#fafaf9',
        }
      },
      fontFamily: {
        sans: ['Noto Sans JP', 'Hiragino Sans', 'Yu Gothic UI', 'system-ui', 'sans-serif'],
      }
    }
  },
  plugins: [],
}
