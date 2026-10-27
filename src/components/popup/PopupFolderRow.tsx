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
  /** Aktif sayfa bu klasörde zaten kayıtlı. */
  hasActivePage: boolean;
  busy: boolean;
  onToggle: () => void;
  onAdd: () => void;
  /** Varsayılan açma (bu pencerede). */
  onOpenAll: () => void;
  /** Tüm açma seçenekleri menüsü. */
  onOpenMenu: (e: MouseEvent<HTMLButtonElement>) => void;
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
  hasActivePage,
  busy,
  onToggle,
  onAdd,
  onOpenAll,
  onOpenMenu,
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
  const accent = folderColorCss(workspace.color);

  const meta = [`${tabs.length} sekme`];
  if (childCount > 0) meta.push(`${childCount} alt klasör`);
  if (matchingTabs && matchingTabs.length > 0) meta.push(`${matchingTabs.length} eşleşme`);

  return (
    <li className="relative" data-folder-row={workspace.id}>
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
          data-nav="row"
          aria-expanded={isExpandable ? isExpanded : undefined}
          // Boş klasörde açılacak bir şey yok ama satır klavyeyle gezilebilsin diye devre dışı bırakılmaz.
          onClick={isExpandable ? onToggle : undefined}
          aria-disabled={isExpandable ? undefined : true}
          title={isExpanded ? 'Sekmeleri gizle' : 'Sekmeleri göster'}
          className="flex min-w-0 flex-1 items-center gap-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-indigo-600 aria-disabled:cursor-default"
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
          label={
            justAdded
              ? 'Eklendi'
              : hasActivePage
                ? `Bu sayfa “${workspace.name}” klasöründe zaten var`
                : `Aktif sayfayı “${workspace.name}” klasörüne ekle`
          }
          onClick={onAdd}
          disabled={busy}
          className={justAdded || hasActivePage ? '' : 'opacity-60 group-hover:opacity-100 focus-visible:opacity-100'}
        >
          {justAdded ? (
            <CheckIcon className="tf-check-pop text-emerald-600" strokeWidth={3} />
          ) : hasActivePage ? (
            <CheckIcon className="text-emerald-600" strokeWidth={2.5} />
          ) : (
            <PlusIcon />
          )}
        </IconButton>
        {/* Bölünmüş düğme: "Aç" varsayılanı yapar, ok tüm seçenekleri (grup, yeni pencere…) gösterir. */}
        <div className="flex shrink-0 items-center rounded-lg bg-gray-100">
          <Button
            variant="secondary"
            size="sm"
            onClick={onOpenAll}
            disabled={busy || subtreeTabCount === 0}
            title={tabs.length > 0 ? 'Klasördeki sekmeleri aç' : 'Alt klasörlerdeki sekmeleri aç'}
            className="rounded-r-none!"
          >
            <ExternalLinkIcon width={13} height={13} />
            Aç
          </Button>
          <button
            type="button"
            onClick={onOpenMenu}
            disabled={busy || subtreeTabCount === 0}
            aria-label={`“${workspace.name}” açma seçenekleri`}
            aria-haspopup="menu"
            title="Açma seçenekleri: alt klasörlerle, sekme grubu, yeni pencere"
            className="inline-flex h-full items-center rounded-r-lg border-l border-gray-200 px-1 py-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ChevronDownIcon width={12} height={12} />
          </button>
        </div>
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
                  data-nav="tab"
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
                  data-nav="tab"
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
