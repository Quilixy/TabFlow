/** chrome.storage.local anahtarları (tek yerde: popup, tam ekran uygulama ve service worker aynı adları kullanır). */
export const WORKSPACES_KEY = 'workspaces';
/** Silinen klasör ve sekmeler (TrashEntry[]). */
export const TRASH_KEY = 'trash';
/** Otomatik günlük yedekler (Snapshot[], yeniden eskiye). */
export const SNAPSHOTS_KEY = 'snapshots';
/** Son anlık görüntünün zamanı: her yazmada büyük yedek listesini okumamak için ayrı tutulur. */
export const SNAPSHOT_META_KEY = 'snapshotMeta';
/** En son sekme eklenen klasör (kısayol ve sağ tık menüsü için). */
export const LAST_FOLDER_KEY = 'lastFolderId';
/** Çözülmüş arayüz dili ('tr' | 'en'): service worker sağ tık menüsü ve rozetler için okur. */
export const LANGUAGE_KEY = 'language';
/** Diske otomatik yedek ayarı ve son zamanı (AutoExportSettings). */
export const AUTO_EXPORT_KEY = 'autoExport';
