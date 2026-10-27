import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Kimliği hiç değişmeyen ama her zaman EN GÜNCEL fonksiyonu çağıran bir geri çağrı döndürür.
 * `React.memo` ile sarılmış kartlara verildiğinde, üst bileşen her render'da yeni closure üretse bile
 * kartlar gereksiz yere yeniden çizilmez.
 */
export function useEventCallback<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  return useCallback((...args: Args) => ref.current(...args), []);
}
