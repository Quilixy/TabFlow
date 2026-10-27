import { memo, useMemo, useState } from 'react';

function extensionFaviconUrl(pageUrl: string): string {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '32');
  return url.toString();
}

interface FaviconProps {
  pageUrl: string;
  fallbackUrl: string | null;
  title: string;
}

/** Hata sayacını tutar. Kaynak listesi değişince dışarıdan `key` ile yeniden kurulur (sayaç sıfırlanır). */
function FaviconImage({ sources, title }: { sources: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const src = sources[index];

  if (!src) {
    return <span className="size-5 rounded bg-gray-200" title={title} aria-hidden="true" />;
  }

  return (
    <img
      src={src}
      alt=""
      title={title}
      width={20}
      height={20}
      loading="lazy"
      className="size-5 rounded bg-[#fff]"
      onError={() => setIndex((i) => i + 1)}
    />
  );
}

export const Favicon = memo(function Favicon({ pageUrl, fallbackUrl, title }: FaviconProps) {
  const sources = useMemo(
    () => [extensionFaviconUrl(pageUrl), fallbackUrl].filter((s): s is string => Boolean(s)),
    [pageUrl, fallbackUrl],
  );
  // Aynı bileşen örneği başka bir sayfaya geçerse (liste güncellemesi) önceki hataların etkisi kalmasın.
  return <FaviconImage key={sources.join('|')} sources={sources} title={title} />;
});
