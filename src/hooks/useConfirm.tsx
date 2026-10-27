import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { t } from '../i18n';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void;
  /** Pencereyi açan öğe: kapanınca odak ona döner. */
  opener: HTMLElement | null;
}

/** Bu kadar kare boyunca (≈5 sn) açan öğenin yeniden etkinleşmesi beklenir (işlem sürerken devre dışıdır). */
const FOCUS_RETRY_FRAMES = 300;

/**
 * Odağı açan öğeye geri verir. Öğe, onaydan sonra süren işlem yüzünden bir süre devre dışı kalabilir; o yüzden
 * etkinleşene kadar bekler. Kullanıcı bu arada başka bir yere odaklandıysa karışmaz.
 */
function restoreFocus(el: HTMLElement | null) {
  let frames = 0;
  const tick = () => {
    if (!el?.isConnected) return;
    const active = document.activeElement;
    if (active && active !== document.body && active !== el) return;
    if (!(el as HTMLButtonElement).disabled) {
      el.focus();
      return;
    }
    if (++frames < FOCUS_RETRY_FRAMES) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * Uygulama içi onay penceresi (window.confirm yerine: sayfayı dondurmaz, temaya uyar).
 * `dialog` düğümünü render et; `confirm` kullanıcı seçince true/false ile çözülür.
 */
export function useConfirm(): { dialog: ReactNode; confirm: (options: ConfirmOptions) => Promise<boolean> } {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setPending((previous) => {
          previous?.resolve(false); // Üst üste açılırsa öncekini iptal say
          return { ...options, resolve, opener: previous?.opener ?? opener };
        });
      }),
    [],
  );

  const settle = useCallback(
    (ok: boolean) => {
      // Modal <dialog> yalnızca close() ile kapanınca odağı geri verir; doğrudan kaldırılırsa odak <body>'ye düşer.
      if (dialogRef.current?.open) dialogRef.current.close();
      pending?.resolve(ok);
      restoreFocus(pending?.opener ?? null);
      setPending(null);
    },
    [pending],
  );

  // showModal: odak tuzağı, Esc ile kapanma ve arka planı etkisizleştirme tarayıcıdan gelir.
  useEffect(() => {
    const el = dialogRef.current;
    if (pending && el && !el.open) el.showModal();
  }, [pending]);

  const dialog = pending ? (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        settle(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) settle(false); // Arka plana tıklama
      }}
      role="alertdialog"
      aria-labelledby="tf-confirm-title"
      aria-describedby={pending.message ? 'tf-confirm-message' : undefined}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white p-0 text-gray-900 shadow-xl backdrop:bg-black/40"
    >
      <div className="p-4">
        <h2 id="tf-confirm-title" className="text-sm font-semibold">
          {pending.title}
        </h2>
        {pending.message && <div id="tf-confirm-message" className="mt-1.5 text-sm whitespace-pre-line text-gray-600">{pending.message}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => settle(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant={pending.danger ? 'danger' : 'primary'} size="sm" autoFocus onClick={() => settle(true)}>
            {pending.confirmLabel ?? t('common.continue')}
          </Button>
        </div>
      </div>
    </dialog>
  ) : null;

  return { dialog, confirm };
}
