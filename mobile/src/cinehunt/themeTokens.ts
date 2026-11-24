/**
 * CineHunt theme tokens: NGUỒN DUY NHẤT cho màu Light/Dark.
 * File thuần TypeScript (không import react-native) để có thể unit test.
 * Bảng màu giữ nguyên như bản gốc; chỉ bổ sung alias có ngữ nghĩa
 * (background, surface, textPrimary...) trỏ tới đúng các giá trị gốc.
 */
export type ThemeMode = 'light' | 'dark';

const DARK = {
  bg: '#080B16', bgSoft: '#0E1324', panel: '#141A30', panel2: '#1C2540',
  stroke: '#303957', purple: '#C2A5FF', violet: '#9267F5',
  cyan: '#59D7FF', green: '#45DBB1', white: '#FAFAFF', muted: '#A4AEC9',
  soft: '#7785A6', orange: '#FFD087', red: '#FF879F',
  brand: '#E4C8FF', line: '#242B42', tabBg: '#0E1324', tabLine: '#38405C',
  logoBg: '#3B2C67', logoLine: '#7763B3', avatarBg: '#25203B', avatarLine: '#574D7F',
  outlineBg: '#0A1830', outlineLine: '#467EB1', dangerBg: '#3A1F32', dangerLine: '#9C4862',
  okBg: '#163635', okLine: '#24564E', okText: '#9EF0DB', badBg: '#3A2235', badLine: '#764154', badText: '#FFBDC9',
  chipBg: '#202D4C', chipLine: '#3C658A', iconA: '#302544', iconB: '#1E3650', iconC: '#322947',
  assistBg: '#202746', assistLine: '#595B93',
  seatFree: '#294D52', seatBlocked: '#3A3B50', seatOff: '#464760', cancelBar: '#774662',
  glow: '#C2A5FF',
};

const LIGHT: typeof DARK = {
  bg: '#FBF5E8', bgSoft: '#F5ECD8', panel: '#FFFDF8', panel2: '#F5ECD8',
  stroke: '#E2D5BA', purple: '#6C3FD1', violet: '#5226B5',
  cyan: '#1F5FE0', green: '#0F7A4F', white: '#2B2236', muted: '#5F5370',
  soft: '#85789A', orange: '#A8620A', red: '#B42318',
  brand: '#5226B5', line: '#E8DBC0', tabBg: '#FFFCF5', tabLine: '#E2D5BA',
  logoBg: '#E7DDFB', logoLine: '#B9A2F0', avatarBg: '#E7DDFB', avatarLine: '#B9A2F0',
  outlineBg: '#EEF3FF', outlineLine: '#7B97F5', dangerBg: '#FBE4E0', dangerLine: '#E0968D',
  okBg: '#E3F5EB', okLine: '#9BD3B5', okText: '#0B5C3B', badBg: '#FBE4E0', badLine: '#E0968D', badText: '#8A1C12',
  chipBg: '#E4ECFF', chipLine: '#9DB5F5', iconA: '#EBE1FC', iconB: '#DDE8FF', iconC: '#EBE1FC',
  assistBg: '#EFE8FD', assistLine: '#C9B8F3',
  seatFree: '#BFE3D0', seatBlocked: '#D9CFB8', seatOff: '#C9BEA5', cancelBar: '#D9877A',
  glow: '#6C3FD1',
};

/** Màu dùng bên trong thẻ gradient tím–xanh: luôn sáng ở cả hai chế độ. */
const FIXED = { lavender: '#E4C8FF', hero: '#FAFAFF', heroCyan: '#59D7FF', heroGreen: '#45DBB1' };

type Base = typeof DARK;

/** Alias có ngữ nghĩa; luôn suy ra từ cùng một bảng màu (không có giá trị riêng). */
function withSemantic(base: Base) {
  return {
    ...base,
    ...FIXED,
    background: base.bg,
    surface: base.panel,
    surfaceRaised: base.panel2,
    textPrimary: base.white,
    textSecondary: base.muted,
    textTertiary: base.soft,
    border: base.stroke,
    brandAccent: base.purple,
    onBrand: base.bg,
    success: base.green,
    warning: base.orange,
    danger: base.red,
  };
}

export type Palette = ReturnType<typeof withSemantic>;

export const PALETTES: Record<ThemeMode, Palette> = {
  light: withSemantic(LIGHT),
  dark: withSemantic(DARK),
};

export const DEFAULT_THEME_MODE: ThemeMode = 'light';

export function paletteFor(mode: ThemeMode): Palette {
  return PALETTES[mode];
}

/** Độ tương phản WCAG 2.x giữa hai màu hex #RRGGBB. */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1, 7), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
