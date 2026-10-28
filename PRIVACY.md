# Privacy Policy · Gizlilik Politikası

**English** · [Türkçe](#türkçe)

_Last updated: 28 October 2026_

TabFlow is a browser extension that saves your tabs into folders. It is built to work entirely on your device.

## What TabFlow stores

- **Saved tabs and folders:** the URL, title and (if Chrome provides one) icon address of each tab you save, plus the folders you create, their names, colors, icons and positions.
- **Settings:** theme, language and similar interface preferences.
- **Backups:** daily snapshots of your folders, and deleted items kept in the trash for 30 days.

All of this is kept in your browser's local extension storage (`chrome.storage.local` and `localStorage`).

## What TabFlow does not do

- It does **not** send any data to any server. TabFlow has no server, no account system and makes no network requests of its own.
- It does **not** use analytics, tracking, advertising or third-party services.
- It does **not** sell, share or transfer your data to anyone.
- The use of information received from Chrome APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), including the Limited Use requirements.
- It does **not** read the content of the pages you visit. It only reads the URL and title of tabs, when you save them, when it shows your open tabs, and to tell you whether the current page is already saved.

## Files on your disk

If automatic backup to disk is on (the default is weekly; you can make it daily or turn it off from the *Backup* menu), TabFlow writes a JSON backup file to `Downloads/TabFlow/` on your computer. These files stay on your computer; TabFlow never uploads them.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `tabs` | Read the URL and title of open tabs to save them; open and close tabs |
| `storage`, `unlimitedStorage` | Keep your folders on your device without running out of space |
| `favicon` | Show site icons from Chrome's own icon cache |
| `contextMenus` | The "Save to TabFlow" right-click menu |
| `tabGroups` | Open a folder as a tab group with its name and color |
| `downloads` | Write the automatic backup file to your Downloads folder |
| `sidePanel` | Show TabFlow in the browser's side panel |
| `bookmarks` (optional) | Read a bookmarks folder you choose to import. Requested only when you use this feature |

## Deleting your data

Delete folders inside TabFlow, or remove the extension: Chrome then deletes all of its stored data. Backup files in `Downloads/TabFlow/` are yours to keep or delete.

## Contact

Questions or concerns: open an issue at <https://github.com/Quilixy/TabFlow/issues>.

---

## Türkçe

_Son güncelleme: 28 Ekim 2026_

TabFlow, sekmelerinizi klasörlere kaydeden bir tarayıcı eklentisidir. Tamamen kendi cihazınızda çalışacak şekilde yapılmıştır.

### TabFlow neleri saklar

- **Kaydedilen sekmeler ve klasörler:** kaydettiğiniz her sekmenin adresi, başlığı ve (Chrome veriyorsa) simge adresi; oluşturduğunuz klasörler ve bunların adı, rengi, simgesi ve konumu.
- **Ayarlar:** tema, dil ve benzeri arayüz tercihleri.
- **Yedekler:** klasörlerin günlük anlık görüntüleri ve çöp kutusunda 30 gün tutulan silinmiş öğeler.

Bunların hepsi tarayıcınızın yerel eklenti deposunda (`chrome.storage.local` ve `localStorage`) tutulur.

### TabFlow neleri yapmaz

- Hiçbir veriyi hiçbir sunucuya **göndermez**. TabFlow'un sunucusu ve hesap sistemi yoktur, kendisi hiçbir ağ isteği yapmaz.
- Analiz, izleme, reklam ya da üçüncü taraf hizmeti **kullanmaz**.
- Verilerinizi kimseye **satmaz, paylaşmaz, aktarmaz**.
- Chrome API'lerinden alınan bilgilerin kullanımı, Sınırlı Kullanım (Limited Use) koşulları dahil [Chrome Web Store Kullanıcı Verileri Politikası](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)'na uyar.
- Ziyaret ettiğiniz sayfaların içeriğini **okumaz**. Sekmelerin yalnızca adresini ve başlığını okur: kaydettiğinizde, açık sekmelerinizi gösterirken ve o anki sayfanın zaten kayıtlı olup olmadığını söylerken.

### Diskinizdeki dosyalar

Diske otomatik yedek açıksa (varsayılan haftalıktır; *Yedek* menüsünden günlük yapılabilir ya da kapatılabilir) TabFlow bilgisayarınızda `İndirilenler/TabFlow/` klasörüne bir JSON yedek dosyası yazar. Bu dosyalar bilgisayarınızda kalır; TabFlow onları hiçbir yere yüklemez.

### İzinler

| İzin | Neden gerekli |
| --- | --- |
| `tabs` | Açık sekmelerin adresini ve başlığını okuyup kaydetmek; sekme açmak ve kapatmak |
| `storage`, `unlimitedStorage` | Klasörlerinizi cihazınızda, yer sıkıntısı olmadan saklamak |
| `favicon` | Site simgelerini Chrome'un kendi simge önbelleğinden göstermek |
| `contextMenus` | Sağ tıktaki "TabFlow'a kaydet" menüsü |
| `tabGroups` | Bir klasörü adı ve rengiyle sekme grubu olarak açmak |
| `downloads` | Otomatik yedek dosyasını İndirilenler klasörüne yazmak |
| `sidePanel` | TabFlow'u tarayıcının yan panelinde göstermek |
| `bookmarks` (isteğe bağlı) | İçe aktarmak için seçtiğiniz yer imi klasörünü okumak. Yalnızca bu özelliği kullandığınızda istenir |

### Verilerinizi silmek

Klasörleri TabFlow içinden silebilir ya da eklentiyi kaldırabilirsiniz; Chrome bu durumda eklentinin sakladığı tüm verileri siler. `İndirilenler/TabFlow/` içindeki yedek dosyaları size aittir; saklayabilir ya da silebilirsiniz.

### İletişim

Soru ve görüşleriniz için: <https://github.com/Quilixy/TabFlow/issues> adresinde bir konu açın.
