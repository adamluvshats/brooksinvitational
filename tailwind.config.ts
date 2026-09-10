import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        fairway: {
          50: "#f0f7f1",
          100: "#dcecdd",
          200: "#bbd9be",
          300: "#8fbf94",
          400: "#5e9e66",
          500: "#3d8146",
          600: "#2d6536",
          700: "#26512d",
          800: "#214127",
          900: "#1c3622",
        },
        sand: {
          100: "#f7f1e3",
          200: "#efe3c4",
        },
      },
    },
  },
  plugins: [],
};

export default config;
