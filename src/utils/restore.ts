import type { FolderColorId } from './folderStyle';

/** Klasör nasıl açılır: bu pencerede sekme olarak, bir sekme grubu olarak ya da yeni bir pencerede. */
export type RestoreMode = 'tabs' | 'group' | 'window';

export interface RestoreResult {
  mode: RestoreMode;
  opened: number;
  /** Bu pencerede zaten açık olduğu için yeniden açılmayanlar. */
  skipped: number;
  /** Açılan ama tıklanınca yüklenecek (ertelenen) sekmeler. */
  deferred: number;
  /** Sekme grubuna alınan toplam sekme (zaten açık olanlar dahil). */
  grouped: number;
}

/** Chrome sekme grubu renkleri. */
export type TabGroupColor = 'grey' | 'blue' | 'red' | 'yellow' | 'green' | 'pink' | 'purple' | 'cyan' | 'orange';

const GROUP_COLORS: Record<FolderColorId, TabGroupColor> = {
  gray: 'grey',
  red: 'red',
  amber: 'orange',
  emerald: 'green',
  sky: 'blue',
  violet: 'purple',
  rose: 'pink',
};

/** Klasör rengine en yakın sekme grubu rengi; renksiz klasör mavi grup olur. */
export function tabGroupColor(folderColor: string | undefined): TabGroupColor {
  return (folderColor && GROUP_COLORS[folderColor as FolderColorId]) || 'blue';
}

/** "Sekmeleri aç" sonucunu kullanıcıya gösterilecek tek cümleye çevirir. */
export function formatRestoreResult(result: RestoreResult, folderName: string): string {
  const { mode, opened, skipped, deferred, grouped } = result;
  const lazy = deferred > 0 ? ` (${deferred} tanesi tıklanınca yüklenecek)` : '';
  if (mode === 'window') return `${opened} sekme yeni pencerede açıldı${lazy}.`;
  if (mode === 'group') {
    if (grouped === 0) return 'Gruplanacak sekme yok (sabitlenmiş sekmeler gruplanamaz).';
    const already = skipped > 0 ? `, ${skipped} tanesi zaten açıktı` : '';
    return `“${folderName}” sekme grubu: ${grouped} sekme${already}${lazy}.`;
  }
  if (opened === 0) return 'Tüm sekmeler zaten açık.';
  const already = skipped > 0 ? `, ${skipped} tanesi zaten açıktı` : '';
  return `${opened} sekme açıldı${already}${lazy}.`;
}
