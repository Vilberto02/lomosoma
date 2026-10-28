/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', '"Rubik Variable"', 'Rubik', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['Monaco', 'Menlo', 'Ubuntu Mono', 'monospace'],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        lomo: {
          canvas: "var(--lomo-canvas)",
          'map-surface': "var(--lomo-map-surface)",
          surface: "var(--lomo-surface)",
          'surface-inset': "var(--lomo-surface-inset)",
          'surface-selected': "var(--lomo-surface-selected)",
          'ink-primary': "var(--lomo-ink-primary)",
          'ink-secondary': "var(--lomo-ink-secondary)",
          'ink-muted': "var(--lomo-ink-muted)",
          'ink-disabled': "var(--lomo-ink-disabled)",
          'action-primary': "var(--lomo-action-primary)",
          'action-hover': "var(--lomo-action-hover)",
          accent: "var(--lomo-accent)",
          'on-action': "var(--lomo-on-action)",
          'on-action-muted': "var(--lomo-on-action-muted)",
          border: "var(--lomo-border)",
          'border-selected': "var(--lomo-border-selected)",
          'warning-ink': "var(--lomo-warning-ink)",
          'warning-surface': "var(--lomo-warning-surface)",
          'warning-border': "var(--lomo-warning-border)",
          'terrain-earth': "var(--lomo-terrain-earth)",
          'terrain-rock': "var(--lomo-terrain-rock)",
          'terrain-mud': "var(--lomo-terrain-mud)",
        }
      },
      borderRadius: {
        '20': '20px',
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'panel': 'var(--shadow-panel)',
        'control': 'var(--shadow-control)',
        'lomo-panel': '0 16px 40px -8px rgba(32, 59, 46, 0.12), 0 4px 12px -2px rgba(32, 59, 46, 0.05)',
        'lomo-card': '0 4px 16px -2px rgba(32, 59, 46, 0.06)',
        'lomo-control': 'var(--shadow-control)',
      }
    },
  },
  plugins: [],
};
