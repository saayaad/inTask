export const DEFAULT_ACCENT_COLOR = '#1c3cee';

export const PRESET_ACCENT_COLORS: { name: string; hex: string }[] = [
  { name: 'Azul In Task (Padrão)', hex: '#1c3cee' },
  { name: 'Rosa Rubi', hex: '#e11d48' },
  { name: 'Esmeralda', hex: '#059669' },
  { name: 'Âmbar Quente', hex: '#d97706' },
  { name: 'Violeta', hex: '#7c3aed' },
  { name: 'Ciano Oceano', hex: '#0891b2' },
  { name: 'Coral', hex: '#ea580c' },
  { name: 'Índigo Profundo', hex: '#4f46e5' },
  { name: 'Verde Floresta', hex: '#15803d' },
  { name: 'Grafite', hex: '#334155' },
];

export function isValidHexColor(input: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(input.trim());
}

export function normalizeHexColor(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!isValidHexColor(trimmed)) {
    return DEFAULT_ACCENT_COLOR;
  }
  if (trimmed.length === 4) {
    const r = trimmed[1];
    const g = trimmed[2];
    const b = trimmed[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return trimmed;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHexColor(hex);
  const num = parseInt(normalized.slice(1), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Relative luminance per WCAG 2.1
 */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const transform = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = transform(r);
  const G = transform(g);
  const B = transform(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Computes --on-accent (#ffffff or #0f172a) to ensure readable text over --accent
 */
export function getOnAccentColor(accentHex: string): '#ffffff' | '#0f172a' {
  const whiteContrast = getContrastRatio(accentHex, '#ffffff');
  const darkContrast = getContrastRatio(accentHex, '#0f172a');
  if (whiteContrast >= 4.5 || whiteContrast >= darkContrast) {
    return '#ffffff';
  }
  return '#0f172a';
}

export function mixHex(hex1: string, hex2: string, weight2: number): string {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  const w = Math.max(0, Math.min(1, weight2));
  return rgbToHex(
    c1.r * (1 - w) + c2.r * w,
    c1.g * (1 - w) + c2.g * w,
    c1.b * (1 - w) + c2.b * w
  );
}

/**
 * Adjusts the accent color so it passes WCAG AA (4.5:1) when used as text/icon on the current theme surface.
 * Darkens on light backgrounds, lightens on dark backgrounds.
 */
export function getAccessibleAccentText(accentHex: string, isDark: boolean): string {
  const bgHex = isDark ? '#080b11' : '#ffffff';
  const targetMix = isDark ? '#ffffff' : '#090d16';
  const current = normalizeHexColor(accentHex);

  if (getContrastRatio(current, bgHex) >= 4.5) {
    return current;
  }

  for (let step = 1; step <= 20; step++) {
    const candidate = mixHex(current, targetMix, step * 0.05);
    if (getContrastRatio(candidate, bgHex) >= 4.5) {
      return candidate;
    }
  }
  return isDark ? '#f3f6fc' : '#090d16';
}

export interface ThemeCssVariables {
  '--accent': string;
  '--accent-hover': string;
  '--accent-soft': string;
  '--accent-border': string;
  '--accent-glow': string;
  '--on-accent': string;
  '--accent-text': string;
}

export function computeThemeVariables(accentHex: string, isDark: boolean): ThemeCssVariables {
  const accent = normalizeHexColor(accentHex);
  const { r, g, b } = hexToRgb(accent);
  const onAccent = getOnAccentColor(accent);
  const accentHover = isDark ? mixHex(accent, '#ffffff', 0.14) : mixHex(accent, '#000000', 0.14);
  const accentSoft = isDark
    ? `rgba(${r}, ${g}, ${b}, 0.18)`
    : `rgba(${r}, ${g}, ${b}, 0.09)`;
  const accentBorder = isDark
    ? `rgba(${r}, ${g}, ${b}, 0.34)`
    : `rgba(${r}, ${g}, ${b}, 0.24)`;
  const accentGlow = isDark
    ? `rgba(${r}, ${g}, ${b}, 0.28)`
    : `rgba(${r}, ${g}, ${b}, 0.16)`;
  const accentText = getAccessibleAccentText(accent, isDark);

  return {
    '--accent': accent,
    '--accent-hover': accentHover,
    '--accent-soft': accentSoft,
    '--accent-border': accentBorder,
    '--accent-glow': accentGlow,
    '--on-accent': onAccent,
    '--accent-text': accentText,
  };
}