export const THEME_MODES = ['system', 'light', 'dark'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** Tema paketleri: "default" kullanıcının Açık/Koyu + vurgu seçimidir; diğerleri kendi renk ve süslerini getirir. */
export const THEME_PACKS = ['default', 'sakura', 'space'] as const;
export type ThemePack = (typeof THEME_PACKS)[number];

export const PACK_LABELS: Record<ThemePack, string> = { default: 'Varsayılan', sakura: 'Sakura', space: 'Uzay' };
/** Menüdeki küçük renk örnekleri. */
export const PACK_SWATCH: Record<ThemePack, readonly [string, string]> = {
  default: ['#6366f1', '#e0e7ff'],
  sakura: ['#e8558a', '#ffe0ea'],
  space: ['#8b5cf6', '#0b0d20'],
};

export const ACCENT_IDS = ['indigo', 'emerald', 'rose', 'sky', 'violet', 'amber'] as const;
export type AccentId = (typeof ACCENT_IDS)[number];

export const ANIMATION_STYLES = ['none', 'pop', 'fade', 'slide'] as const;
export type AnimationStyle = (typeof ANIMATION_STYLES)[number];

export const THEME_LABELS: Record<ThemeMode, string> = { system: 'Sistem', light: 'Açık', dark: 'Koyu' };
export const ANIMATION_LABELS: Record<AnimationStyle, string> = {
  none: 'Yok',
  pop: 'Büyüme',
  fade: 'Solma',
  slide: 'Kayma',
};
export const ACCENT_LABELS: Record<AccentId, string> = {
  indigo: 'İndigo',
  emerald: 'Zümrüt',
  rose: 'Gül',
  sky: 'Gök mavisi',
  violet: 'Menekşe',
  amber: 'Kehribar',
};
export const ACCENT_SWATCH: Record<AccentId, string> = {
  indigo: '#6366f1',
  emerald: '#10b981',
  rose: '#f43f5e',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
  amber: '#f59e0b',
};

/** Silme animasyonunun süresi (ms): öğe bu kadar beklenip sonra gerçekten silinir. */
export const LEAVE_ANIMATION_MS = 180;

export interface ThemeSettings {
  theme: ThemeMode;
  accent: AccentId;
  animation: AnimationStyle;
  pack: ThemePack;
  /** Dekoratif efektler (yaprak, yıldız, süsler). Yalnızca paketlerde anlamlıdır. */
  decor: boolean;
}

export const resolveTheme = (mode: ThemeMode, systemPrefersDark: boolean): 'light' | 'dark' =>
  mode === 'system' ? (systemPrefersDark ? 'dark' : 'light') : mode;

const oneOf = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  typeof value === 'string' && (list as readonly string[]).includes(value) ? (value as T) : fallback;

/** Ayarları <html> üzerindeki data-* özniteliklerine yazar; CSS (theme.css) bunlara göre çalışır. */
export function applyTheme(
  settings: ThemeSettings,
  systemPrefersDark: boolean,
  root: { dataset: Record<string, string | undefined> } = document.documentElement,
): void {
  const pack = oneOf(THEME_PACKS, settings.pack, 'default');
  // Her paket hem açık hem koyu çalışır: ton, kullanıcının Açık/Koyu/Sistem seçiminden gelir.
  root.dataset.theme = resolveTheme(oneOf(THEME_MODES, settings.theme, 'system'), systemPrefersDark);
  root.dataset.accent = oneOf(ACCENT_IDS, settings.accent, 'indigo');
  root.dataset.anim = oneOf(ANIMATION_STYLES, settings.animation, 'pop');
  root.dataset.pack = pack;
  root.dataset.decor = pack !== 'default' && settings.decor !== false ? 'on' : 'off';
}