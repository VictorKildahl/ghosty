/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: "#f4f1ea",
        ink: "#1c242b",
        moss: "#2f6f5e",
        clay: "#d9c5ad",
        ember: "#d6764b"
      },
      boxShadow: {
        soft: "0 12px 40px rgba(28, 36, 43, 0.14)"
      },
      borderRadius: {
        xl: "18px"
      }
    }
  },
  plugins: []
};
