import { AUTO_EXPORT_KEY } from '../storage/keys';
import { readKey } from '../storage/kv';
import { readWorkspaceMap } from '../storage/workspaceStore';
import { autoExportFileName, isAutoExportDue, normalizeAutoExport, toBase64Utf8 } from '../utils/autoExport';
import { createBackup, serializeBackup } from '../utils/backup';

let inFlight: Promise<boolean> | null = null;

/**
 * Zamanı geldiyse klasörlerin yedeğini İndirilenler/TabFlow klasörüne yazar. Aynı anda gelen tetiklemeler tek
 * işlemde birleşir. Klasör yoksa yazmaz (boş yedek dosyası anlamsız). Yazıldıysa true.
 */
export function maybeAutoExport(now: number = Date.now()): Promise<boolean> {
  inFlight ??= run(now).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(now: number): Promise<boolean> {
  const settings = normalizeAutoExport(await readKey<unknown>(AUTO_EXPORT_KEY, null));
  if (!isAutoExportDue(settings, now)) return false;
  const workspaces = await readWorkspaceMap();
  if (Object.keys(workspaces).length === 0) return false;

  const json = serializeBackup(createBackup(workspaces, new Date(now)));
  await chrome.downloads.download({
    url: `data:application/json;base64,${toBase64Utf8(json)}`,
    filename: autoExportFileName(new Date(now)),
    conflictAction: 'uniquify',
    saveAs: false,
  });
  // Ayar bu arada değişmiş olabilir (ör. kapatıldı): yalnızca zamanı güncelle.
  const latest = normalizeAutoExport(await readKey<unknown>(AUTO_EXPORT_KEY, null));
  await chrome.storage.local.set({ [AUTO_EXPORT_KEY]: { ...latest, lastAt: now } });
  return true;
}
