export const theme = {
  colors: {
    brand: '#33aa55',
    brandDark: '#33aa55',
    brandSoft: '#eaf5ed',
    ink: '#111111',
    muted: '#8a908c',
    line: '#e3e6e3',
    paper: '#ffffff',
    background: '#f2f5f1',
    backgroundAccent: '#e7f2e9',
    danger: '#ed8c6b',
    avatarCoral: '#f4b3a4',
    avatarSage: '#bfdbbd',
    avatarSun: '#f6d77c',
    avatarMint: '#a9dbba',
  },
  fonts: {
    body: "'Inter', sans-serif",
    display: "'Nunito Local', sans-serif",
    logo: "Georgia, 'Times New Roman', serif",
  },
  fontSizes: {
    xs: '0.6875rem',
    sm: '0.8125rem',
    base: '0.9375rem',
    lg: '1.125rem',
    xl: '1.5625rem',
  },
  spacing: {
    sidebarWidth: '240px',
    topbarHeight: '52px',
    bottomNavHeight: '56px',
    contentMaxWidth: '640px',
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    pill: '8px',
  },
  breakpoints: {
    desktop: '768px',
  },
} as const;

export type Theme = typeof theme;

export function themeToCssVars(): Record<string, string> {
  const vars: Record<string, string> = {};

  for (const [key, value] of Object.entries(theme.colors)) {
    vars[`--color-${camelToKebab(key)}`] = value;
  }

  for (const [key, value] of Object.entries(theme.fonts)) {
    vars[`--font-${camelToKebab(key)}`] = value;
  }

  for (const [key, value] of Object.entries(theme.fontSizes)) {
    vars[`--text-${camelToKebab(key)}`] = value;
  }

  for (const [key, value] of Object.entries(theme.spacing)) {
    vars[`--space-${camelToKebab(key)}`] = value;
  }

  for (const [key, value] of Object.entries(theme.radius)) {
    vars[`--radius-${camelToKebab(key)}`] = value;
  }

  vars['--breakpoint-desktop'] = theme.breakpoints.desktop;

  return vars;
}

function camelToKebab(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}
