/** @type {import('tailwindcss').Config} */
// Design tokens shared with the CampusOne mobile app. Colors resolve to CSS
// variables (src/index.css), so `.dark` on <html> re-themes every token class.
// Tailwind's default palette stays available (extend) while screens migrate.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Plus Jakarta Sans", "Hind Siliguri", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        brand: { DEFAULT: "var(--brand)", 700: "var(--brand-700)", 50: "var(--brand-50)", 100: "var(--brand-100)" },
        bg: "var(--bg)",
        surface: "var(--surface)", "surface-2": "var(--surface-2)", "surface-3": "var(--surface-3)",
        brd: "var(--border)", "brd-2": "var(--border-2)",
        ink: "var(--text)", "ink-2": "var(--text-2)", "ink-3": "var(--text-3)",
        success: { DEFAULT: "var(--success)", bg: "var(--success-bg)" },
        warn: { DEFAULT: "var(--warn)", bg: "var(--warn-bg)" },
        danger: { DEFAULT: "var(--danger)", bg: "var(--danger-bg)" },
        info: { DEFAULT: "var(--info)", bg: "var(--info-bg)" },
        sector: {
          reports: "#4f6bed", lostfound: "#c77d1a", clubs: "#8b5cf0", events: "#e0568a",
          jobs: "#0e9c8a", announce: "#3e7de0", study: "#2ba0c9", bus: "#e08a2b", medical: "#e2483d",
          market: "#2e9e63", ride: "#6e8b1f", blood: "#c7344a", directory: "#5b6b86", prayer: "#1f8a5b",
          faculty: "#0e9c8a", calendar: "#d4553a", routines: "#5c6bc0", coverpage: "#00838f",
          pdfmaker: "#b12f8c",
        },
      },
      borderRadius: { xs: "8px", sm: "10px", md: "14px", lg: "18px", xl: "22px", "2xl": "26px", "3xl": "32px", full: "999px" },
      boxShadow: {
        sm: "0 1px 2px rgba(15,26,46,.05)",
        md: "0 2px 6px rgba(15,26,46,.06)",
        lg: "0 6px 16px rgba(15,26,46,.10)",
        xl: "0 12px 32px rgba(15,26,46,.18)",
      },
      fontSize: {
        xs: ["11px", "16px"], sm: ["12px", "18px"], base: ["13px", "20px"], md: ["14px", "21px"],
        lg: ["15px", "22px"], xl: ["16px", "24px"], "2xl": ["18px", "26px"], "3xl": ["21px", "28px"],
        "4xl": ["26px", "32px"], "5xl": ["32px", "40px"],
      },
    },
  },
  plugins: [],
};
