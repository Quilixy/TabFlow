import { useEffect, useState } from 'react';
import { useUiStore, type Toast as ToastData } from '../../store/useUiStore';
import { XIcon } from './icons';

const TOAST_DURATION_MS = 6000;

interface ToastProps {
  /**
   * 'inline': sayfa akışında durur (hiçbir düğmenin üstüne binmez; dar popup için).
   * Verilmezse ekrana sabitlenir; konum `className` ile ayarlanır.
   */
  inline?: boolean;
  /** Sabit bildirimin konum/genişlik sınıfları. */
  className?: string;
}

export function Toast({ inline = false, className = 'inset-x-3 bottom-3' }: ToastProps) {
  const toast = useUiStore((s) => s.toast);
  const dismissToast = useUiStore((s) => s.dismissToast);
  // Hangi bildirim için durdurulduğu tutulur: yeni bildirim (veya kapanma) duraklatmayı kendiliğinden bitirir.
  const [pausedFor, setPausedFor] = useState<ToastData | null>(null);
  const isPaused = toast !== null && pausedFor === toast;

  // Üzerine gelinince/odaklanınca süre durur ("Geri al"a yetişmek için); ayrılınca baştan başlar.
  useEffect(() => {
    if (!toast || isPaused) return;
    const timer = setTimeout(dismissToast, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast, isPaused, dismissToast]);

  const action = toast?.action;

  // Canlı bölge her zaman DOM'da kalır: içerikle birlikte eklenen bölgeyi ekran okuyucular çoğu zaman duyurmaz.
  return (
    <div role="status" aria-live="polite" className={inline ? 'shrink-0 empty:-mt-3' : `pointer-events-none fixed z-50 ${className}`}>
      {toast && (
        <div
          onMouseEnter={() => setPausedFor(toast)}
          onMouseLeave={() => setPausedFor(null)}
          onFocus={() => setPausedFor(toast)}
          onBlur={() => setPausedFor(null)}
          className="pointer-events-auto flex items-center justify-between gap-2 rounded-lg border border-[rgb(255_255_255/0.12)] bg-[#111827] py-2 pr-1.5 pl-3 text-sm text-[#fff] shadow-lg"
        >
          <span className="min-w-0">{toast.message}</span>
          <div className="flex shrink-0 items-center">
            {action && (
              <button
                type="button"
                onClick={() => {
                  action.run();
                  dismissToast();
                }}
                className="rounded px-2 py-1 text-xs font-semibold text-indigo-300 hover:bg-[rgb(255_255_255/0.1)]"
              >
                {action.label}
              </button>
            )}
            <button
              type="button"
              aria-label="Bildirimi kapat"
              title="Kapat"
              onClick={dismissToast}
              className="inline-flex size-6 items-center justify-center rounded text-[rgb(255_255_255/0.6)] hover:bg-[rgb(255_255_255/0.1)] hover:text-[#fff]"
            >
              <XIcon width={14} height={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
