import type { MouseEvent } from 'react';
import type { SavedTab, Workspace } from '../../types';
import { folderColorCss } from '../../utils/folderStyle';
import { Favicon } from '../Favicon';
import { Button } from '../ui/Button';
import { FolderGlyph } from '../ui/FolderGlyph';
import { CheckIcon, ChevronDownIcon, ExternalLinkIcon, PinIcon, PlusIcon } from '../ui/icons';
import { IconButton } from '../ui/IconButton';

const COLLAPSED_FAVICONS = 4;
const EXPANDED_TAB_LIMIT = 30;
/** Her ağaç düzeyinin girintisi (px). */
const INDENT = 18;
const ROW_PAD = 4;

/** Düzeyin ağaç çizgisinin x konumu: o düzeydeki ok simgesinin ortası. */
const guideX = (level: number) => ROW_PAD + level * INDENT + 9;

interface PopupFolderRowProps {
  workspace: Workspace;
  depth: number;
  /** Üst klasörün adı (ekran okuyucu için konum bilgisi). */
  parentName: string | null;
  childCount: number;
  /** Klasör + tüm alt klasörlerdeki toplam sekme. */
  subtreeTabCount: number;
  /** Sekme listesi açık mı (aç/kapa düğmesinin denetlediği şey; alt klasörler aramada hep görünür). */
  isExpanded: boolean;
  /** Aramada: eşleşen sekmeler (varsa yalnızca onlar gösterilir). null: arama yok. */
  matchingTabs: SavedTab[] | null;
  justAdded: boolean;
  busy: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onOpenAll: (e: MouseEvent<HTMLButtonElement>) => void;
  onOpenTab: (tab: SavedTab) => void;
  /** Sığmayan sekmeler için: klasörü tam ekranda aç. */
  onShowMore: () => void;
}

export function PopupFolderRow({
  workspace,
  depth,
  parentName,
  childCount,
  subtreeTabCount,
  isExpanded,
  matchingTabs,
  justAdded,
  busy,
  onToggle,
  onAdd,
  onOpenAll,
  onOpenTab,
  onShowMore,
}: PopupFolderRowProps) {
  const { tabs } = workspace;
  // Klasör adıyla eşleşip sekmesi eşleşmeyen klasör açılınca tüm sekmeleri göster.
  const listTabs = matchingTabs && matchingTabs.length > 0 ? matchingTabs : tabs;
  const previewTabs = tabs.slice(0, COLLAPSED_FAVICONS);
  const extra = tabs.length - previewTabs.length;
  const shownTabs = listTabs.slice(0, EXPANDED_TAB_LIMIT);

  const isExpandable = tabs.length > 0 || childCount > 0;
  // Alt klasörlerde de sekme varsa iki seçenek sunulur; klasörün kendi sekmesi yoksa doğrudan hepsi açılır.
  const offersChoice = subtreeTabCount > tabs.length && tabs.length > 0;
  const accent = folderColorCss(workspace.color);

  const meta = [`${tabs.length} sekme`];
  if (childCount > 0) meta.push(`${childCount} alt klasör`);
  if (matchingTabs && matchingTabs.length > 0) meta.push(`${matchingTabs.length} eşleşme`);

  return (
    <li className="relative">
      {/* Üst düzeylerin ağaç çizgileri */}
      {Array.from({ length: depth }, (_, level) => (
        <span
          key={level}
          aria-hidden="true"
          className="absolute inset-y-0 w-px bg-gray-200"
          style={{ left: guideX(level) }}
        />
      ))}

      <div
        className={`group flex items-center gap-1 rounded-lg py-1.5 pr-1.5 transition-colors ${
          justAdded ? 'bg-emerald-50' : 'hover:bg-gray-50'
        }`}
        style={{ paddingLeft: ROW_PAD + depth * INDENT }}
      >
        <button
          type="button"
          aria-expanded={isExpandable ? isExpanded : undefined}
          onClick={onToggle}
          disabled={!isExpandable}
          title={isExpanded ? 'Sekmeleri gizle' : 'Sekmeleri göster'}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-default"
        >
          <ChevronDownIcon
            width={14}
            height={14}
            className={`size-[18px] shrink-0 p-0.5 text-gray-400 transition-transform ${isExpanded ? '' : '-rotate-90'} ${
              isExpandable ? '' : 'invisible'
            }`}
          />
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-md"
            style={{ backgroundColor: `color-mix(in srgb, ${accent} 14%, transparent)` }}
          >
            <FolderGlyph icon={workspace.icon} color={workspace.color} width={15} height={15} />
          </span>
          <span className="ml-1 min-w-0 flex-1">
            <span className="flex items-center gap-1 text-sm font-medium text-gray-900" title={workspace.name}>
              <span className="truncate">{workspace.name}</span>
              {workspace.favorite && (
                <PinIcon width={11} height={11} className="shrink-0 text-gray-400" aria-label="Sabitlenmiş" role="img" />
              )}
              {parentName && <span className="sr-only">, “{parentName}” içinde</span>}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="truncate">{meta.join(' · ')}</span>
              {!isExpanded && previewTabs.length > 0 && (
                <span className="flex shrink-0 items-center" aria-hidden="true">
                  <span className="flex items-center -space-x-1 [&_img]:size-3.5 [&_img]:ring-2 [&_img]:ring-white [&>span]:size-3.5">
                    {previewTabs.map((tab) => (
                      <Favicon key={tab.id} pageUrl={tab.url} fallbackUrl={tab.favIconUrl} title={tab.title} />
                    ))}
                  </span>
                  {extra > 0 && <span className="pl-1 text-[11px] text-gray-400">+{extra}</span>}
                </span>
              )}
            </span>
          </span>
        </button>

        <IconButton
          label={justAdded ? 'Eklendi' : `Aktif sayfayı “${workspace.name}” klasörüne ekle`}
          onClick={onAdd}
          disabled={busy}
          className={justAdded ? '' : 'opacity-60 group-hover:opacity-100 focus-visible:opacity-100'}
        >
          {justAdded ? <CheckIcon className="tf-check-pop text-emerald-600" strokeWidth={3} /> : <PlusIcon />}
        </IconButton>
        <Button
          variant="secondary"
          size="sm"
          onClick={onOpenAll}
          disabled={busy || subtreeTabCount === 0}
          title={
            offersChoice
              ? 'Sekmeleri aç (alt klasörler dahil seçilebilir)'
              : subtreeTabCount > tabs.length
                ? 'Alt klasörlerdeki tüm sekmeleri aç'
                : 'Klasördeki tüm sekmeleri aç'
          }
          aria-haspopup={offersChoice ? 'menu' : undefined}
        >
          <ExternalLinkIcon width={13} height={13} />
          Aç
          {offersChoice && <ChevronDownIcon width={12} height={12} className="-mr-0.5 text-gray-500" />}
        </Button>
      </div>

      {isExpanded && listTabs.length > 0 && (
        <div className="relative">
          {/* Bu klasörün sekmelerini alt klasörlerine bağlayan çizgi */}
          <span aria-hidden="true" className="absolute inset-y-0 w-px bg-gray-200" style={{ left: guideX(depth) }} />
          <ul
            className="max-h-48 space-y-px overflow-y-auto py-0.5 pr-1.5"
            style={{ paddingLeft: ROW_PAD + (depth + 1) * INDENT }}
          >
            {shownTabs.map((tab) => (
              <li key={tab.id}>
                <button
                  type="button"
                  onClick={() => onOpenTab(tab)}
                  disabled={busy}
                  title={`${tab.title}\n${tab.url}\nTıkla: arka planda aç`}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-gray-50 [&_img]:size-4 [&>span:first-child]:size-4"
                >
                  <Favicon pageUrl={tab.url} fallbackUrl={tab.favIconUrl} title={tab.title} />
                  <span className="truncate text-xs text-gray-700">{tab.title}</span>
                </button>
              </li>
            ))}
            {listTabs.length > shownTabs.length && (
              <li>
                <button
                  type="button"
                  onClick={onShowMore}
                  className="w-full rounded-md px-2 py-1 text-left text-xs font-medium text-indigo-700 hover:bg-gray-50"
                >
                  +{listTabs.length - shownTabs.length} sekme daha · tam ekranda gör
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </li>
  );
}
