import { useEffect, useRef, useState } from 'react';
import { useUiStore } from '../store/useUiStore';
import {
  ACCENT_IDS,
  ACCENT_LABELS,
  ACCENT_SWATCH,
  ANIMATION_LABELS,
  ANIMATION_STYLES,
  PACK_LABELS,
  PACK_SWATCH,
  THEME_LABELS,
  THEME_MODES,
  THEME_PACKS,
  type ThemeMode,
} from '../utils/theme';
import { CheckIcon, MoonIcon, MonitorIcon, SlidersIcon, SunIcon } from './ui/icons';
import { IconButton } from './ui/IconButton';
import { LANGUAGE_SETTINGS, t, type LanguageSetting, type MessageKey } from '../i18n';

const LANGUAGE_LABELS: Record<LanguageSetting, MessageKey> = { auto: 'lang.auto', tr: 'lang.tr', en: 'lang.en' };

const THEME_ICONS: Record<ThemeMode, typeof SunIcon> = {
  system: MonitorIcon,
  light: SunIcon,
  dark: MoonIcon,
};

/** Tema, vurgu rengi ve klasör animasyonu seçimi. */
export function AppearanceMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const accent = useUiStore((s) => s.accent);
  const setAccent = useUiStore((s) => s.setAccent);
  const animation = useUiStore((s) => s.animation);
  const setAnimation = useUiStore((s) => s.setAnimation);
  const pack = useUiStore((s) => s.pack);
  const setPack = useUiStore((s) => s.setPack);
  const decor = useUiStore((s) => s.decor);
  const setDecor = useUiStore((s) => s.setDecor);
  const language = useUiStore((s) => s.language);
  const setLanguage = useUiStore((s) => s.setLanguage);
  const isPack = pack !== 'default';

  useEffect(() => {
    if (!isOpen) return;
    // Açılınca odağı pencerenin içindeki seçili seçeneğe taşı (klavyeyle doğrudan gezilebilsin).
    const panel = rootRef.current?.querySelector<HTMLElement>('[role="dialog"]');
    (panel?.querySelector<HTMLElement>('[aria-pressed="true"]') ?? panel?.querySelector<HTMLElement>('button'))?.focus();

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setIsOpen(false);
      rootRef.current?.querySelector<HTMLElement>('[aria-haspopup="dialog"]')?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={rootRef}
      className="relative z-40"
      // Sekme tuşuyla pencereden çıkılınca kapan (aksi halde sayfanın üstünde açık kalırdı).
      onBlur={(e) => {
        if (isOpen && !(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) {
          if (e.relatedTarget !== null) setIsOpen(false);
        }
      }}
    >
      <IconButton label={t('appearance.button')} aria-expanded={isOpen} aria-haspopup="dialog" onClick={() => setIsOpen((v) => !v)}>
        <SlidersIcon />
      </IconButton>

      {isOpen && (
        <div
          role="dialog"
          aria-label={t('appearance.dialog')}
          className="absolute top-full right-0 z-50 mt-2 w-72 space-y-4 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
        >
          <section>
            <h3 className="mb-1.5 text-xs font-medium text-gray-500">{t('appearance.pack')}</h3>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
              {THEME_PACKS.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={pack === id}
                  onClick={() => setPack(id)}
                  className={`flex flex-col items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                    pack === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <span className="flex" aria-hidden="true">
                    <span className="size-3.5 rounded-full border border-gray-300" style={{ backgroundColor: PACK_SWATCH[id][0] }} />
                    <span className="-ml-1 size-3.5 rounded-full border border-gray-300" style={{ backgroundColor: PACK_SWATCH[id][1] }} />
                  </span>
                  {t(PACK_LABELS[id])}
                </button>
              ))}
            </div>
            {isPack && (
              <>
                <p className="mt-2 text-xs text-gray-500">
                  {t('appearance.packAccent', { pack: t(PACK_LABELS[pack]) })}
                </p>
                <label className="mt-2 flex items-start gap-2 text-sm text-gray-800">
                  <input
                    type="checkbox"
                    checked={decor}
                    onChange={(e) => setDecor(e.target.checked)}
                    className="mt-0.5 size-4 accent-indigo-600"
                  />
                  <span>
                    {t('appearance.decor')}
                    <span className="block text-xs text-gray-500">
                      {pack === 'sakura' ? t('appearance.decorSakura') : t('appearance.decorSpace')}
                    </span>
                  </span>
                </label>
              </>
            )}
          </section>

          <section>
            <h3 className="mb-1.5 text-xs font-medium text-gray-500">{t('appearance.theme')}</h3>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
              {THEME_MODES.map((mode) => {
                const ThemeIcon = THEME_ICONS[mode];
                const selected = theme === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setTheme(mode)}
                    className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                      selected ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <ThemeIcon width={14} height={14} />
                    {t(THEME_LABELS[mode])}
                  </button>
                );
              })}
            </div>
          </section>

          {!isPack && (
            <section>
              <h3 className="mb-1.5 text-xs font-medium text-gray-500">{t('appearance.accent')}</h3>
              <div className="flex flex-wrap gap-2">
                {ACCENT_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    title={t(ACCENT_LABELS[id])}
                    aria-label={t(ACCENT_LABELS[id])}
                    aria-pressed={accent === id}
                    onClick={() => setAccent(id)}
                    style={{ backgroundColor: ACCENT_SWATCH[id] }}
                    className="inline-flex size-7 items-center justify-center rounded-full text-[#fff] ring-offset-2 ring-offset-white focus-visible:outline-2 focus-visible:outline-indigo-600 aria-pressed:ring-2 aria-pressed:ring-gray-500"
                  >
                    {accent === id && <CheckIcon width={14} height={14} />}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-1.5 text-xs font-medium text-gray-500">{t('appearance.animation')}</h3>
            <p className="mb-1.5 text-xs text-gray-500">{t('appearance.animationNote')}</p>
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-gray-100 p-1">
              {ANIMATION_STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  aria-pressed={animation === style}
                  onClick={() => setAnimation(style)}
                  className={`rounded-md px-1 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                    animation === style ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t(ANIMATION_LABELS[style])}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-1.5 text-xs font-medium text-gray-500">{t('appearance.language')}</h3>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
              {LANGUAGE_SETTINGS.map((setting) => (
                <button
                  key={setting}
                  type="button"
                  lang={setting === 'auto' ? undefined : setting}
                  aria-pressed={language === setting}
                  onClick={() => setLanguage(setting)}
                  className={`rounded-md px-1 py-1.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-indigo-600 ${
                    language === setting ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t(LANGUAGE_LABELS[setting])}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}