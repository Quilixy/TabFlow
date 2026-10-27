import { en } from './en';
import { tr, type MessageEntry, type Messages, type MessageParams } from './tr';

/**
 * Arayüz dili. Metinler `t('anahtar', { parametre })` ile alınır; Türkçe sözlük kaynaktır, İngilizce sözlük aynı
 * anahtarları taşımak zorundadır (eksik çeviri derlenmez). Çoğul gibi dile özgü biçimler sözlükte fonksiyondur.
 * Dil modül düzeyinde tutulur: React dışı kod (service worker, biçimlendiriciler) de aynı `t`yi kullanır.
 */

export const LANGUAGES = ['tr', 'en'] as const;
export type Lang = (typeof LANGUAGES)[number];
/** Kullanıcı ayarı: 'auto' tarayıcının diline uyar. */
export const LANGUAGE_SETTINGS = ['auto', ...LANGUAGES] as const;
export type LanguageSetting = (typeof LANGUAGE_SETTINGS)[number];
export type MessageKey = keyof Messages;

const DICTIONARIES: Record<Lang, Messages> = { tr, en };

// Varsayılan Türkçe: testler ve dil henüz ayarlanmamış kod Türkçe görür.
let current: Lang = 'tr';

/** Tarayıcının arayüz dili Türkçe ise 'tr', değilse 'en'. */
export function detectLanguage(): Lang {
  let ui = '';
  try {
    ui = (typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage?.()) || '';
  } catch {
    // chrome.i18n yok (test ortamı)
  }
  if (!ui && typeof navigator !== 'undefined') ui = navigator.language ?? '';
  return ui.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

export const resolveLanguage = (setting: LanguageSetting): Lang => (setting === 'auto' ? detectLanguage() : setting);

export function setLanguage(lang: Lang): void {
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export const getLanguage = (): Lang => current;

/** Tarih/sayı biçimlendirme için yerel ayar. */
export const localeTag = (): string => (current === 'tr' ? 'tr-TR' : 'en-US');

const interpolate = (text: string, params?: MessageParams): string =>
  params ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match)) : text;

const render = (entry: MessageEntry, params?: MessageParams): string =>
  typeof entry === 'function' ? entry(params ?? {}) : interpolate(entry, params);

export function t(key: MessageKey, params?: MessageParams): string {
  return render(DICTIONARIES[current][key] ?? tr[key], params);
}

/** Belirli bir dilde metin (ör. service worker'ın kayıtlı dil ayarıyla). */
export function tIn(lang: Lang, key: MessageKey, params?: MessageParams): string {
  return render(DICTIONARIES[lang][key] ?? tr[key], params);
}

export const isLanguageSetting = (value: unknown): value is LanguageSetting =>
  typeof value === 'string' && (LANGUAGE_SETTINGS as readonly string[]).includes(value);
