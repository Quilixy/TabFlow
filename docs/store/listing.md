# Chrome Web Store kaydı

Mağaza geliştirici panelindeki formlara kopyalanacak metinler. Görseller bu klasörde: `en/` ve `tr/`
(`npm run screenshots` ile yeniden üretilir). Yüklenecek paket: `npm run package` → `release/tabflow-<sürüm>.zip`.

## Store listing (Mağaza girişi)

- **Category:** Productivity → Workflow & Planning
- **Language:** English (varsayılan), ardından *Add localization* ile Turkish
- **Icon:** `public/icons/icon-128.png`
- **Screenshots (1280×800):** `screenshot-1.jpg` … `screenshot-5.jpg`
- **Small promo tile (440×280):** `promo-small.jpg`
- **Marquee promo tile (1400×560):** `promo-marquee.jpg`
- **Homepage URL:** https://github.com/Quilixy/TabFlow
- **Support URL:** https://github.com/Quilixy/TabFlow/issues

Ad ve kısa açıklama manifest'ten gelir (`public/_locales/*/messages.json`); formda değiştirilemez.

### Description (English)

```
Too many tabs open? TabFlow saves them into folders so you can close them and bring them back in seconds.

SAVE
• Save all open tabs, or just the current page, to a folder in one click.
• Group by site: tabs from the same site go into their own subfolder.
• Right-click any page or link → Save to TabFlow. Alt+Shift+S saves the current page to your last folder.

ORGANIZE
• Nested folders with colors and 35 icons. Pin your favorites to the top.
• A full-screen app with a free-form canvas for every folder: drag, drop, zoom, snap to grid, select many at once.
• Command palette (Ctrl+K) to jump to any folder or run any action.

FIND AND RESTORE
• Search every saved tab and folder from the popup, or type "tf" in the address bar.
• Reopen a folder in this window, as a tab group with the folder's name and color, or in a new window.
• Opening many tabs at once? Only the first 10 load right away, so your memory stays free.
• Works in the side panel too, and stays open while you browse.

NEVER LOSE ANYTHING
• Trash keeps deleted folders and tabs for 30 days.
• Daily snapshots, and an automatic weekly backup file in your Downloads folder that survives even if the extension is removed.
• Import from OneTab, a list of URLs or your Chrome bookmarks. Export and import JSON backups.

MAKE IT YOURS
• Theme packs: Sakura (a cherry tree swaying in the wind) and Space (a rotating galaxy and Orion), each in light and dark.
• English and Turkish interface.

PRIVATE BY DESIGN
Everything stays in your browser. TabFlow has no server, no account, no analytics and makes no network requests.

Open source: https://github.com/Quilixy/TabFlow
```

### Açıklama (Türkçe)

```
Çok fazla sekme mi açık? TabFlow onları klasörlere kaydeder; kapatırsın, saniyeler içinde geri açarsın.

KAYDET
• Tüm açık sekmeleri ya da yalnızca o anki sayfayı tek tıkla bir klasöre kaydet.
• Siteye göre grupla: aynı sitenin sekmeleri kendi alt klasörüne gider.
• Herhangi bir sayfaya ya da bağlantıya sağ tıkla → TabFlow'a kaydet. Alt+Shift+S o anki sayfayı son klasöre kaydeder.

DÜZENLE
• Renkli ve 35 simgeli iç içe klasörler. Sık kullandıklarını üste sabitle.
• Her klasör için serbest bir tuvali olan tam ekran uygulama: sürükle-bırak, yakınlaştır, ızgaraya diz, çoklu seç.
• Komut paleti (Ctrl+K) ile istediğin klasöre git ya da bir işlem çalıştır.

BUL VE GERİ AÇ
• Kayıtlı tüm sekme ve klasörleri popup'tan ara ya da adres çubuğuna "tf" yaz.
• Klasörü bu pencerede, klasörün adı ve renginde bir sekme grubu olarak ya da yeni pencerede aç.
• Çok sayıda sekme açarken yalnızca ilk 10'u hemen yüklenir; bellek şişmez.
• Yan panelde de çalışır ve gezinirken açık kalır.

HİÇBİR ŞEYİ KAYBETME
• Çöp kutusu silinen klasörleri ve sekmeleri 30 gün saklar.
• Günlük anlık görüntüler ve İndirilenler klasörüne haftalık otomatik yedek dosyası: eklenti kaldırılsa bile kalır.
• OneTab'dan, bir adres listesinden ya da Chrome yer imlerinden içe aktar. JSON yedeği al ve geri yükle.

SANA GÖRE
• Tema paketleri: Sakura (rüzgârda salınan kiraz ağacı) ve Uzay (dönen galaksi ve Avcı takımyıldızı), her biri açık ve koyu.
• Türkçe ve İngilizce arayüz.

GİZLİLİK ÖNCELİKLİ
Her şey tarayıcında kalır. TabFlow'un sunucusu, hesap sistemi ve analizi yoktur; hiçbir ağ isteği yapmaz.

Açık kaynak: https://github.com/Quilixy/TabFlow
```

## Privacy practices (Gizlilik uygulamaları sekmesi)

### Single purpose description

```
TabFlow saves the user's browser tabs into folders and restores them later. Every feature (popup, full-screen canvas, side panel, context menu, address bar search, backups and import) serves saving, organizing and reopening tabs.
```

### Permission justification

| İzin | Form'a yazılacak gerekçe |
| --- | --- |
| `tabs` | Reads the URL and title of open tabs so the user can save them into folders, shows the user's open tabs in the app, and opens or closes tabs when the user restores or saves a folder. |
| `storage` | Stores the user's folders, saved tabs, settings, trash and daily snapshots locally on the device. |
| `unlimitedStorage` | Users can save thousands of tabs with their trash and snapshots; without it the local storage quota can fill up and saving would fail. |
| `favicon` | Shows each saved tab's site icon from Chrome's own favicon cache instead of loading it from the web. |
| `contextMenus` | Adds the "Save to TabFlow" menu to pages and links so the user can save without opening the popup. |
| `tabGroups` | Lets the user open a folder as a tab group that has the folder's name and color. |
| `downloads` | Writes the automatic backup file (JSON) to the user's Downloads/TabFlow folder, so their data survives if the extension is removed. The user can turn this off. |
| `sidePanel` | Shows the TabFlow interface in the browser's side panel when the user chooses "Open in side panel". |
| `bookmarks` (optional) | Requested at runtime only when the user chooses to import a bookmarks folder; used only to read that folder. |
| Host permissions | Yok. |

### Remote code

```
No, I am not using remote code.
```

### Data usage

İşaretlenecek veri türü: **Web history** (kaydedilen sekmelerin adresi ve başlığı). Veriler cihazdan çıkmasa da
işaretlemek, incelemede "bildirilmemiş veri" gerekçesiyle ret riskini ortadan kaldırır. Diğer türler işaretlenmez.

Üç beyanın üçü de işaretlenir:

- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:** https://github.com/Quilixy/TabFlow/blob/main/PRIVACY.md

## Distribution

- **Visibility:** Public
- **Regions:** All regions
- **Pricing:** Free
