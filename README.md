# TabFlow

Sekmelerini klasörlere ve serbest bir tuvale kaydet, kapat ve saniyeler içinde geri yükle. Chrome (Manifest V3) eklentisi.

## Özellikler

- **Popup:** açık sekmelerin tümünü ya da yalnızca aktif sayfayı tek tıkla bir klasöre kaydet; klasörleri ara, iç içe klasörleri aç, sekmeleri tek tek ya da alt klasörleriyle birlikte geri aç.
- **Tam ekran uygulama** (`Alt+Shift+T` ya da popup'taki "Tam ekranda aç"): solda klasör ağacı, ortada her klasörün kendi tuvali (sürükle-bırak, yakınlaştır, ızgaraya diz), sağda açık sekmeler.
- İç içe klasörler, klasör rengi ve simgesi, tema paketleri (açık/koyu, vurgu rengi).
- **Açma seçenekleri:** klasörü bu pencerede, alt klasörleriyle birlikte, klasörün adı ve renginde bir **sekme grubu** olarak ya da **yeni pencerede** aç.
- **Sıralama ve sabitleme:** ağaçta bir klasörü başka bir satırın üst/alt kenarına sürükleyerek sırala (`Alt+↑/↓` da olur); "Üste sabitle" ile sık kullanılanları en üstte tut.
- **Tuvalde çoklu seçim:** `Ctrl`/`Shift` + tık ile seç, `Shift` + boş alanda sürükleyerek alan seç, `Ctrl+A` ile tümünü seç. Seçilenleri birlikte sürükle, bir klasöre bırak, sağ tıkla taşı ya da `Delete` ile sil.
- **Türkçe ve İngilizce arayüz:** *Görünüm → Dil* (Otomatik tarayıcının dilini izler). Eklentinin adı, açıklaması ve kısayol açıklamaları da çevrilidir.
- **Popup:** aktif sayfa kayıtlıysa hangi klasörlerde olduğunu gösterir; arama sonuçlarında ok tuşlarıyla gezilir (`↓` sonuçlara iner, `→`/`←` klasörü açar/kapatır).
- Türkçe karakterlere duyarlı arama: "istanbul" → "İstanbul", "calisma" → "Çalışma".
- Çok sayıda sekme açılırken ilk 10'u yüklenir, kalanlar tıklanınca yüklenir (RAM şişmez).
- **Sağ tık menüsü:** bir sayfaya ya da bağlantıya sağ tıkla → *TabFlow'a kaydet* → klasör. Popup'ı açmadan kaydeder; simgedeki rozet sonucu gösterir (✓ kaydedildi, = zaten vardı, ! kaydedilemedi).
- **Çöp kutusu:** silinen klasörler (alt klasörleriyle) ve sekmeler 30 gün saklanır; tam ekran uygulamadan tek tek geri yüklenir.
- **Otomatik yedek:** günde bir kez klasörlerin anlık görüntüsü alınır, son 7'si tutulur (*Yedek* menüsü). Bir yedeğe dönmeden önce o anki hal de yedeklenir.
- JSON yedeği alma ve geri yükleme. Geri yüklemede mevcut veriler silinmez, aynı klasörün sekmeleri birleştirilir.

## Klavye kısayolları

| Kısayol | Ne yapar |
| --- | --- |
| `Alt+Shift+T` | Tam ekran uygulamayı aç |
| `Alt+Shift+S` | Aktif sayfayı son kullanılan klasöre kaydet |

Kısayollar `chrome://extensions/shortcuts` adresinden değiştirilebilir.

## Kurulum (geliştirme)

```bash
npm install
npm run build        # dist/ klasörünü üretir
```

1. Chrome'da `chrome://extensions` adresini aç.
2. Sağ üstten **Geliştirici modu**nu aç.
3. **Paketlenmemiş öğe yükle** → `dist/` klasörünü seç.

Değişiklikleri izleyerek derlemek için `npm run watch` kullan; ardından eklentiler sayfasında TabFlow'u yenile.

Her push ve pull request'te GitHub Actions tip kontrolü, lint, birim testleri, derleme ve uçtan uca testleri çalıştırır (`.github/workflows/ci.yml`).

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `npm run build` | Tip kontrolü + üretim derlemesi (`dist/`) |
| `npm run watch` | Değişiklikte yeniden derler |
| `npm test` | Birim testleri (Vitest) |
| `npm run test:e2e` | Derleyip eklentiyi gerçek Chromium'a yükleyerek uçtan uca testleri çalıştırır (Playwright; ilk seferde `npx playwright install chromium`) |
| `npm run typecheck` | TypeScript tip kontrolü |
| `npm run lint` | ESLint |

## İzinler

| İzin | Neden |
| --- | --- |
| `tabs` | Açık sekmelerin adresini/başlığını okumak, sekme açmak ve kapatmak |
| `storage`, `unlimitedStorage` | Klasörleri yerel olarak saklamak (çok sayıda sekmede kota dolmasın) |
| `favicon` | Site simgelerini Chrome'un önbelleğinden göstermek |
| `contextMenus` | Sayfa ve bağlantılarda "TabFlow'a kaydet" menüsü |
| `tabGroups` | Klasörü adı ve rengiyle bir sekme grubu olarak açmak |

Veriler yalnızca bu tarayıcıda (`chrome.storage.local`) tutulur; hiçbir sunucuya gönderilmez.

## Yedek dosyası

```json
{
  "app": "TabFlow",
  "schemaVersion": 2,
  "exportedAt": "2026-10-27T10:00:00.000Z",
  "workspaces": {
    "<klasör-id>": {
      "id": "<klasör-id>",
      "name": "Staj",
      "parentId": null,
      "createdAt": 1761559200000,
      "updatedAt": 1761559200000,
      "x": 32,
      "y": 32,
      "tabs": [{ "id": "…", "url": "https://…", "title": "…", "favIconUrl": null, "pinned": false, "x": 32, "y": 32 }]
    }
  }
}
```

İçe aktarmada yalnızca `http(s)` adresli sekmeler alınır; geçersiz öğeler atlanır ve sayısı bildirilir.

## Proje yapısı

```
public/_locales/  manifest metinleri (ad, açıklama, kısayollar)
src/
  background/   service worker (kısayollar, sağ tık menüsü, otomatik yedek)
  popup/        araç çubuğu açılır penceresi
  app/          tam ekran uygulama
  components/   arayüz bileşenleri (app/, popup/, ui/)
  hooks/        depolama, sekme ve onay kancaları
  storage/      React'ten bağımsız depolama (kilitli yazma, yedekler); service worker da kullanır
  store/        arayüz durumu (zustand) ve pencereler arası eşitleme
  services/     React'ten bağımsız sekme açma (popup bunu service worker'a yaptırır)
  i18n/         arayüz metinleri: tr.ts (kaynak) ve en.ts; t('anahtar', { parametre })
  utils/        saf mantık (ağaç, arama, yedek, tuval matematiği) ve testleri
  styles/       tema değişkenleri
```

## Çeviri

Arayüz metinleri `src/i18n/tr.ts` (kaynak) ve `src/i18n/en.ts` dosyalarındadır. Yeni bir metin eklerken iki dosyaya
da aynı anahtarı ekle; İngilizce sözlükte eksik anahtar derleme hatası verir. Çoğul gereken İngilizce metinler
`plural()` kullanan küçük fonksiyonlardır. Manifest metinleri `public/_locales/<dil>/messages.json` içindedir.
