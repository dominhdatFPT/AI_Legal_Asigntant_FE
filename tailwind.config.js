module.exports = {
  content: [
    "./AI_Legal/src/pages/**/*.html",
    "./AI_Legal/src/**/*.js"
  ],
  darkMode: "class",
  theme: {
    extend: {
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-up": "fade-up 550ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-up-late": "fade-up 650ms cubic-bezier(0.22, 1, 0.36, 1) 120ms both",
        "fade-up-later": "fade-up 650ms cubic-bezier(0.22, 1, 0.36, 1) 240ms both",
        "fade-up-last": "fade-up 700ms cubic-bezier(0.22, 1, 0.36, 1) 360ms both"
      },
      colors: {
        "surface-panel": "#FFFFFF",
        "secondary-fixed-dim": "#bcc8d6",
        "border-focus": "#DA251D",
        "tertiary-fixed-dim": "#ecc15a",
        primary: "#b40006",
        "tertiary-container": "#8d6b02",
        "on-tertiary": "#ffffff",
        "on-secondary-fixed-variant": "#3d4854",
        "on-primary-fixed-variant": "#930004",
        "secondary-fixed": "#d8e4f3",
        "inverse-on-surface": "#e8f1ff",
        "surface-brand-tint": "#FDF2F1",
        "on-tertiary-fixed": "#251a00",
        "state-success": "#15803D",
        surface: "#f7f9ff",
        "primary-fixed-dim": "#ffb4a9",
        "primary-fixed": "#ffdad5",
        "on-primary": "#ffffff",
        "surface-dim": "#d0dbea",
        "on-error-container": "#93000a",
        "inverse-surface": "#27313d",
        "on-primary-container": "#fff3f1",
        "outline-variant": "#e6bdb7",
        "on-error": "#ffffff",
        "on-secondary": "#ffffff",
        "surface-subtle": "#F8FAFC",
        "border-subtle": "#E2E8F0",
        "secondary-container": "#d8e4f3",
        "inverse-primary": "#ffb4a9",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#edf4ff",
        "on-tertiary-fixed-variant": "#5a4300",
        "on-surface-variant": "#5d403b",
        outline: "#916f6a",
        "primary-container": "#da251d",
        "surface-container-highest": "#d8e3f3",
        "on-surface": "#121c27",
        "on-primary-fixed": "#410001",
        secondary: "#545f6c",
        background: "#f7f9ff",
        "on-secondary-fixed": "#111d27",
        "tertiary-fixed": "#ffdf99",
        "on-tertiary-container": "#fff4e2",
        "surface-tint": "#bf080b",
        "error-container": "#ffdad6",
        "on-background": "#121c27",
        "surface-container-high": "#dee9f9",
        tertiary: "#6f5400",
        "on-secondary-container": "#5a6572",
        "surface-bright": "#f7f9ff",
        "state-error": "#B91C1C",
        "surface-variant": "#d8e3f3",
        "surface-container": "#e4effe"
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem"
      },
      spacing: {
        "space-xl": "2.5rem",
        "space-md": "1rem",
        gutter: "1.5rem",
        "space-lg": "1.5rem",
        margin: "2rem",
        "space-xs": "0.25rem",
        "space-sm": "0.5rem"
      },
      fontFamily: {
        "headline-lg-mobile": ["Be Vietnam Pro"],
        "body-lg": ["Be Vietnam Pro"],
        "headline-lg": ["Be Vietnam Pro"],
        "label-md": ["Be Vietnam Pro"],
        "headline-sm": ["Be Vietnam Pro"],
        "display-hero": ["Be Vietnam Pro"],
        "headline-md": ["Be Vietnam Pro"],
        "body-md": ["Be Vietnam Pro"],
        "label-sm": ["Be Vietnam Pro"],
        "label-lg": ["Be Vietnam Pro"],
        "body-sm": ["Be Vietnam Pro"]
      },
      fontSize: {
        "headline-lg-mobile": ["26px", { lineHeight: "34px", letterSpacing: "-0.01em", fontWeight: "700" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.015em", fontWeight: "700" }],
        "label-md": ["13px", { lineHeight: "18px", fontWeight: "500" }],
        "headline-sm": ["20px", { lineHeight: "28px", fontWeight: "600" }],
        "display-hero": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
        "headline-md": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-sm": ["11px", { lineHeight: "14px", letterSpacing: "0.04em", fontWeight: "600" }],
        "label-lg": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "600" }],
        "body-sm": ["12px", { lineHeight: "16px", fontWeight: "400" }]
      }
    }
  },
  plugins: []
};