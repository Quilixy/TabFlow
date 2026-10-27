export interface Point {
  x: number;
  y: number;
}

/** Bir sayfanın kaydedilebilir özeti (hem açık sekmeden hem kayıtlı sekmeden türetilir). */
export interface PageInfo {
  url: string;
  title: string;
  favIconUrl: string | null; // Ham URL; base64 saklama (kota şişer)
  pinned: boolean;
}

/** Klasör tuvali üzerindeki bir sekme kartı. x/y: tuval (dünya) koordinatı. */
export interface SavedTab extends PageInfo {
  id: string;
  x: number;
  y: number;
}

export interface Workspace {
  id: string;        // crypto.randomUUID()
  name: string;
  createdAt: number; // Date.now()
  updatedAt: number;
  parentId: string | null; // null = kök
  x: number;         // Üst klasörün tuvalindeki konum
  y: number;
  tabs: SavedTab[];
  /** Klasör rengi (FolderColorId). Yoksa temanın vurgu rengi kullanılır. */
  color?: string;
  /** Klasör simgesi (FolderIconId). Yoksa klasör simgesi. */
  icon?: string;
  /** Kardeşleri arasında elle verilen sıra (küçük önce). Yoksa ada göre, sıralı olanların ardından. */
  order?: number;
  /** Sabitlenmiş (sık kullanılan): kardeşlerinin en üstünde durur. */
  favorite?: boolean;
}

/** Menüler ve hedef listeleri için klasörün hafif gösterimi. name = "Üst / Alt" yolu. */
export interface FolderRef {
  id: string;
  name: string;
}

export type WorkspaceMap = Record<string, Workspace>;

export interface StorageSchema {
  schemaVersion: 2;
  workspaces: WorkspaceMap;
}
