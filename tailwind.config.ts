import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F4F4F5",
        foreground: "#1A1A2E",
        primary: {
          DEFAULT: "#4361EE",
          foreground: "#FFFFFF",
        },
        secondary: {
          DEFAULT: "#2ECC9A",
          foreground: "#FFFFFF",
        },
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#1A1A2E",
        },
        muted: {
          DEFAULT: "#F1F5F9",
          foreground: "#6B7280",
        },
        accent: {
          DEFAULT: "#F1F5F9",
          foreground: "#1A1A2E",
        },
        border: "#E5E7EB",
        input: "#E5E7EB",
        ring: "#4361EE",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "calc(0.75rem - 2px)",
        sm: "calc(0.75rem - 4px)",
      },
      boxShadow: {
        premium: "0 10px 15px -3px rgba(0, 0, 0, 0.04), 0 4px 6px -2px rgba(0, 0, 0, 0.02)",
        soft: "0 4px 20px -2px rgba(0, 0, 0, 0.03)",
      },
    },
  },
  plugins: [],
};

export default config;
