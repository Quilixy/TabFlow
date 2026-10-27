/** Klasör rengi: yalnızca bu kimlikler kabul edilir (dosyadan gelen veri güvenilmezdir). */
export const FOLDER_COLORS = {
  gray: '#6b7280',
  red: '#ef4444',
  amber: '#f59e0b',
  emerald: '#10b981',
  sky: '#0ea5e9',
  violet: '#8b5cf6',
  rose: '#f43f5e',
} as const;

export type FolderColorId = keyof typeof FOLDER_COLORS;

export const FOLDER_COLOR_LABELS: Record<FolderColorId, string> = {
  gray: 'Gri',
  red: 'Kırmızı',
  amber: 'Turuncu',
  emerald: 'Yeşil',
  sky: 'Mavi',
  violet: 'Mor',
  rose: 'Pembe',
};

export const FOLDER_ICON_IDS = [
  'folder',
  'star',
  'heart',
  'bookmark',
  'briefcase',
  'book',
  'code',
  'terminal',
  'cart',
  'music',
  'globe',
  'zap',
  'home',
  'rocket',
  'planet',
] as const;

export type FolderIconId = (typeof FOLDER_ICON_IDS)[number];

export const FOLDER_ICON_LABELS: Record<FolderIconId, string> = {
  folder: 'Klasör',
  star: 'Yıldız',
  heart: 'Kalp',
  bookmark: 'Yer imi',
  briefcase: 'İş',
  book: 'Kitap',
  code: 'Kod',
  terminal: 'Terminal',
  cart: 'Alışveriş',
  music: 'Müzik',
  globe: 'Web',
  zap: 'Hızlı',
  home: 'Ev',
  rocket: 'Roket',
  planet: 'Gezegen',
};

/** Renk seçilmediyse klasör, temanın vurgu rengini kullanır. */
export const DEFAULT_FOLDER_COLOR_CSS = 'var(--ac-500)';

export const isFolderColor = (value: unknown): value is FolderColorId =>
  typeof value === 'string' && Object.hasOwn(FOLDER_COLORS, value);

export const isFolderIcon = (value: unknown): value is FolderIconId =>
  typeof value === 'string' && (FOLDER_ICON_IDS as readonly string[]).includes(value);

export const folderColorCss = (id: unknown): string =>
  isFolderColor(id) ? FOLDER_COLORS[id] : DEFAULT_FOLDER_COLOR_CSS;
