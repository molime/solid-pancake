// Shared Clerk `appearance` so embedded Clerk UIs (UserProfile on the
// agency Account page, the platform-admin Account section, …) render in the
// Atria dark theme instead of Clerk's default light card. This Clerk version
// (v6) styles via appearance.variables — colorForeground/colorMutedForeground
// are the keys that drive its internal text (the classic colorText/
// colorTextSecondary keys are kept for older components). Values mirror the
// tokens in src/index.css (@theme block) — keep them in sync.
export const atriaClerkAppearance = {
  baseTheme: 'dark',
  variables: {
    colorBackground: '#11171a', // --color-atria-surface
    colorInputBackground: '#161d21', // --color-atria-surface-2
    colorInputText: '#f2f6f7', // --color-atria-ink
    colorText: '#f2f6f7',
    colorTextSecondary: '#aebcc2', // --color-atria-text-secondary
    // Clerk v6 naming for the same two roles (the classic colorText/
    // colorTextSecondary keys are ignored by the v6 component family).
    colorForeground: '#f2f6f7',
    colorMutedForeground: '#aebcc2',
    colorPrimaryForeground: '#04140e', // --color-atria-on-accent
    colorPrimary: '#16a34a', // --color-atria-accent
    colorDanger: '#f0564a', // --color-atria-danger
    colorNeutral: '#aebcc2',
    borderRadius: '12px', // --radius-atria-md
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  },
  elements: {
    rootBox: { background: 'transparent' },
    card: {
      background: '#11171a',
      border: '1px solid #2a373d', // --color-atria-border
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.4)', // --shadow-atria-card
    },
    navbar: {
      background: '#11171a',
      borderRight: '1px solid #2a373d',
    },
    navbarButton: { color: '#aebcc2' },
    navbarButton__active: {
      background: 'rgba(22, 163, 74, 0.14)', // --color-atria-accent-quiet
      color: '#f2f6f7',
    },
    pageScrollBox: { background: '#11171a' },
    headerTitle: { color: '#f2f6f7' },
    headerSubtitle: { color: '#aebcc2' },
    formFieldLabel: { color: '#aebcc2' },
    formFieldInput: {
      background: '#161d21',
      borderColor: '#2a373d',
      color: '#f2f6f7',
    },
    dividerLine: { background: '#2a373d' },
    dividerText: { color: '#6e808a' }, // --color-atria-text-muted
  },
} as const
