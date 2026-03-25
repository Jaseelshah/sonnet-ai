import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#07090F",
        accent: "#00FFB2",
        critical: "#FF4444",
        high: "#FF8C00",
        medium: "#FFD700",
        low: "#00FFB2",
      },
    },
  },
  plugins: [],
};

export default config;
