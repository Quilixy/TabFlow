import { Fragment, type ReactNode } from 'react';
import { resolveLanguage, setLanguage } from '../i18n';
import { useUiStore } from '../store/useUiStore';

/**
 * Dil değişince tüm arayüzü yeni dille yeniden kurar. Metinler modül düzeyindeki `t()` ile alındığından, dili
 * çizimden önce ayarlayıp alt ağacı dil anahtarıyla yenilemek yeterlidir (dil değişimi seyrek bir işlemdir).
 */
export function LanguageRoot({ children }: { children: ReactNode }) {
  const lang = resolveLanguage(useUiStore((s) => s.language));
  setLanguage(lang);
  return <Fragment key={lang}>{children}</Fragment>;
}
