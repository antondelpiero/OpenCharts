export default {
  plugins: {
    // Tailwind v4 ships its own PostCSS plugin and handles vendor prefixing
    // internally (Lightning CSS), so autoprefixer is no longer in the chain.
    "@tailwindcss/postcss": {},
  },
};
