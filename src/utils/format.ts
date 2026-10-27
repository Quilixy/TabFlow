/** "az önce", "5 dk önce", "3 sa önce", "2 gün önce" */
export function formatAgo(timestamp: number, now: number = Date.now()): string {
  const minutes = Math.floor(Math.max(0, now - timestamp) / 60_000);
  if (minutes < 1) return 'az önce';
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}
/** "Sekmeleri aç" sonucunu kullanıcıya gösterilecek tek cümleye çevirir. */
export function formatRestoreMessage({ opened, skipped, deferred = 0 }: { opened: number; skipped: number; deferred?: number }): string {
  if (opened === 0) return 'Tüm sekmeler zaten açık.';
  let message = `${opened} sekme açıldı`;
  if (skipped > 0) message += `, ${skipped} tanesi zaten açıktı`;
  if (deferred > 0) message += ` (${deferred} tanesi tıklanınca yüklenecek)`;
  return message + '.';
}

/** "Tümünü kaydet" sonucu: kaydedilen sayı, açık bırakılan (web dışı) sekmeler ve kapatma hatası. */
export function formatSaveAllMessage(saved: number, folderName: string, skipped: number, closeFailed: boolean): string {
  let message = `${saved} sekme “${folderName}” klasörüne kaydedildi`;
  if (closeFailed) message += ', ancak sekmeler kapatılamadı';
  message += '.';
  if (skipped > 0) message += ` ${skipped} sekme web sayfası olmadığı için açık bırakıldı.`;
  return message;
}

const dateTimeFormat = new Intl.DateTimeFormat('tr', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** "27 Eki 14:05" */
export const formatDateTime = (timestamp: number): string => dateTimeFormat.format(timestamp);
