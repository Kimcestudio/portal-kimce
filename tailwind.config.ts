import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#f6f7fc",
        primary: "#4f56d3",
        primaryDark: "#3b42c6",
        ink: "#1f2245",
        muted: "#7a7f9a",
        line: "#eef0f6",
      },
      boxShadow: {
        card: "0 20px 40px rgba(25, 28, 55, 0.08)",
        soft: "0 12px 20px rgba(25, 28, 55, 0.08)",
        glow: "0 0 0 6px rgba(79, 86, 211, 0.2)",
      },
      borderRadius: {
        xl: "20px",
        "2xl": "24px",
      },
    },
  },
  plugins: [],
};

export default config;
