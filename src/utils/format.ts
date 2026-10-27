import { localeTag, t } from '../i18n';

/** "az önce", "5 dk önce", "3 sa önce", "2 gün önce" */
export function formatAgo(timestamp: number, now: number = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60_000);
  if (minutes < 1) return t('time.justNow');
  if (minutes < 60) return t('time.minutesAgo', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('time.hoursAgo', { n: hours });
  return t('time.daysAgo', { n: Math.floor(hours / 24) });
}

/** "Tümünü kaydet" sonucu: kaydedilen sayı, açık bırakılan (web dışı) sekmeler ve kapatma hatası. */
export function formatSaveAllMessage(
  saved: number,
  folderName: string,
  skipped: number,
  closeFailed: boolean,
  subfolders = 0,
): string {
  let message = t('saveAll.saved', { n: saved, folder: folderName });
  if (closeFailed) message += t('saveAll.closeFailed');
  message += '.';
  if (subfolders > 0) message += ` ${t('saveAll.grouped', { n: subfolders })}`;
  if (skipped > 0) message += ` ${t('saveAll.skipped', { n: skipped })}`;
  return message;
}

/** "27 Eki 14:05" (seçili dilin biçimiyle) */
export const formatDateTime = (timestamp: number): string =>
  new Intl.DateTimeFormat(localeTag(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    timestamp,
  );
