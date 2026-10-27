import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AccentId, AnimationStyle, ThemeMode, ThemePack } from '../utils/theme';
import { preserveForeignFields } from '../utils/uiSync';
import { t } from '../i18n';
import type { LanguageSetting } from '../i18n';

/** Satır içi yeniden adlandırma alanının gösterileceği yer: aynı anda yalnızca biri açılır. */
export type RenameSource = 'tree' | 'canvas';

export interface Toast {
  message: string;
  action?: { label: string; run: () => void };
}

interface UiState {
  // Kalıcı (localStorage): tam ekran uygulamanın gezinti durumu
  selectedFolderId: string | null;
  expanded: Record<string, boolean>;
  /** Popup'ta sekme listesi açık klasörler (popup her açılışta sıfırdan başlamasın). */
  popupExpanded: Record<string, boolean>;
  lastBackupAt: number | null;
  theme: ThemeMode;
  accent: AccentId;
  animation: AnimationStyle;
  pack: ThemePack;
  decor: boolean;
  /** Klasör kartlarında alt klasörlerin içeriğini de göster. */
  deepPreview: boolean;
  /** Tam ekranda sol klasör paneli gizli. */
  sidebarCollapsed: boolean;
  /** Arayüz dili ('auto': tarayıcının dili). */
  language: LanguageSetting;
  // Oturumluk
  draftName: string;
  includePinned: boolean;
  closeOnAdd: boolean;
  /** "Tümünü kaydet": siteye göre alt klasörlere ayır. */
  groupByDomain: boolean;
  query: string;
  dropHoverId: string | null;
  renamingId: string | null;
  renamingSource: RenameSource;
  /** Yeni eklenen (giriş animasyonu oynayan) ve silinmekte olan (çıkış animasyonu) klasör kimlikleri. */
  enterIds: Record<string, true>;
  leavingIds: Record<string, true>;
  /** Sakura yaprak dağılması: ekranda nerede (px) ve hangi anahtarla oynadığı. */
  burst: { key: number; x: number; y: number } | null;
  errorMessage: string | null;
  toast: Toast | null;
  setSelectedFolder: (id: string | null) => void;
  setExpanded: (id: string, open: boolean) => void;
  setPopupExpanded: (id: string, open: boolean) => void;
  expandMany: (ids: string[]) => void;
  setDraftName: (value: string) => void;
  setIncludePinned: (value: boolean) => void;
  setCloseOnAdd: (value: boolean) => void;
  setGroupByDomain: (value: boolean) => void;
  setQuery: (value: string) => void;
  setDropHover: (id: string | null) => void;
  setRenamingId: (id: string | null, source?: RenameSource) => void;
  setLastBackupAt: (timestamp: number) => void;
  setTheme: (value: ThemeMode) => void;
  setAccent: (value: AccentId) => void;
  setAnimation: (value: AnimationStyle) => void;
  setPack: (value: ThemePack) => void;
  setDecor: (value: boolean) => void;
  setDeepPreview: (value: boolean) => void;
  toggleSidebar: () => void;
  setLanguage: (value: LanguageSetting) => void;
  triggerBurst: (x: number, y: number) => void;
  markEntering: (ids: string[]) => void;
  setLeaving: (ids: string[], leaving: boolean) => void;
  showError: (message: string) => void;
  clearError: () => void;
  showToast: (message: string, action?: Toast['action']) => void;
  dismissToast: () => void;
}

/** zustand persist anahtarı (localStorage). `storage` olaylarını süzmek için dışarıya açık. */
export const UI_STORAGE_KEY = 'tabflow-ui';

const ENTER_MARK_MS = 800;

/**
 * persist her setState'te yazar (sürükleme vurgusu, arama yazımı gibi oturumluk alanlarda bile). Kalıcı kısım
 * değişmediyse yazma: localStorage eşzamanlıdır ve her yazma diğer pencerelerde `storage` olayı doğurur.
 */
/** Bu pencerenin sahibi olmadığı (başka pencereye ait) kalıcı alanlar: yazarken depodaki değerleri korunur. */
const FOREIGN_FIELDS: readonly string[] =
  typeof location !== 'undefined' && location.pathname.includes('/popup/')
    ? ['selectedFolderId', 'expanded', 'sidebarCollapsed'] // tam ekran uygulamanın gezinti ve yerleşim durumu
    : ['popupExpanded'];

function dedupedLocalStorage(): Storage {
  return {
    get length() {
      return localStorage.length;
    },
    key: (index) => localStorage.key(index),
    clear: () => localStorage.clear(),
    getItem: (name) => localStorage.getItem(name),
    removeItem: (name) => localStorage.removeItem(name),
    setItem: (name, value) => {
      const stored = localStorage.getItem(name);
      const next = preserveForeignFields(value, stored, FOREIGN_FIELDS);
      if (stored !== next) localStorage.setItem(name, next);
    },
  };
}

const BURST_MS = 1100;
let burstSeq = 0;

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedFolderId: null,
      expanded: {},
      popupExpanded: {},
      lastBackupAt: null,
      theme: 'system',
      accent: 'indigo',
      animation: 'pop',
      pack: 'default',
      decor: true,
      deepPreview: true,
      sidebarCollapsed: false,
      language: 'auto',
      draftName: '',
      includePinned: false,
      closeOnAdd: false,
      groupByDomain: false,
      query: '',
      dropHoverId: null,
      renamingId: null,
      renamingSource: 'tree',
      enterIds: {},
      leavingIds: {},
      burst: null,
      errorMessage: null,
      toast: null,
      setSelectedFolder: (selectedFolderId) => set({ selectedFolderId }),
      setExpanded: (id, open) => set((s) => ({ expanded: { ...s.expanded, [id]: open } })),
      setPopupExpanded: (id, open) =>
        set((s) => {
          const next = { ...s.popupExpanded };
          if (open) next[id] = true;
          else delete next[id]; // Kapalı olanı saklama: kayıt büyümesin
          return { popupExpanded: next };
        }),
      expandMany: (ids) =>
        set((s) => {
          const next = { ...s.expanded };
          for (const id of ids) next[id] = true;
          return { expanded: next };
        }),
      setDraftName: (draftName) => set({ draftName }),
      setIncludePinned: (includePinned) => set({ includePinned }),
      setCloseOnAdd: (closeOnAdd) => set({ closeOnAdd }),
      setGroupByDomain: (groupByDomain) => set({ groupByDomain }),
      setQuery: (query) => set({ query }),
      setDropHover: (dropHoverId) => set({ dropHoverId }),
      setRenamingId: (renamingId, renamingSource = 'tree') => set({ renamingId, renamingSource }),
      setLastBackupAt: (lastBackupAt) => set({ lastBackupAt }),
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setAnimation: (animation) => set({ animation }),
      setPack: (pack) => set({ pack }),
      setDecor: (decor) => set({ decor }),
      setDeepPreview: (deepPreview) => set({ deepPreview }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setLanguage: (language) => set({ language }),
      triggerBurst: (x, y) => {
        const key = ++burstSeq;
        set({ burst: { key, x, y } });
        setTimeout(() => {
          // Aynı anda başka bir dağılma başladıysa ona dokunma.
          if (useUiStore.getState().burst?.key === key) set({ burst: null });
        }, BURST_MS);
      },
      markEntering: (ids) => {
        set((s) => ({ enterIds: { ...s.enterIds, ...Object.fromEntries(ids.map((id) => [id, true as const])) } }));
        // Giriş animasyonu bitince işareti kaldır (sanallaştırmada satır yeniden bağlanınca tekrar oynamasın).
        setTimeout(() => {
          set((s) => {
            const next = { ...s.enterIds };
            for (const id of ids) delete next[id];
            return { enterIds: next };
          });
        }, ENTER_MARK_MS);
      },
      setLeaving: (ids, leaving) =>
        set((s) => {
          const next = { ...s.leavingIds };
          for (const id of ids) {
            if (leaving) next[id] = true;
            else delete next[id];
          }
          return { leavingIds: next };
        }),
      showError: (errorMessage) => set({ errorMessage }),
      clearError: () => set({ errorMessage: null }),
      // Her çağrıda yeni nesne üretilir; Toast bileşeni süreyi bu sayede sıfırlar.
      showToast: (message, action) => set({ toast: { message, action } }),
      dismissToast: () => set({ toast: null }),
    }),
    {
      name: UI_STORAGE_KEY,
      storage: createJSONStorage(dedupedLocalStorage),
      partialize: (s) => ({
        selectedFolderId: s.selectedFolderId,
        expanded: s.expanded,
        popupExpanded: s.popupExpanded,
        closeOnAdd: s.closeOnAdd,
        groupByDomain: s.groupByDomain,
        lastBackupAt: s.lastBackupAt,
        theme: s.theme,
        accent: s.accent,
        animation: s.animation,
        pack: s.pack,
        decor: s.decor,
        deepPreview: s.deepPreview,
        sidebarCollapsed: s.sidebarCollapsed,
        language: s.language,
      }),
    },
  ),
);

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return t('common.unexpectedError');
}