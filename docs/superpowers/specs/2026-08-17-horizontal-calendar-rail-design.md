# Yatay aylık takvim şeridi tasarımı

## Amaç

Varsayılan takvim görünümü, ekrana göre ızgara yapan yıllık kartlar yerine aynı hizada soldan sağa uzanan on iki aylık bir şerit olur. Kullanıcı hem masaüstünde hem mobilde aylar arasında doğal yatay kaydırma ile ilerler. Takvim PDF'deki yoğun aylık ritmi korur; mevcut veri, senkronizasyon, filtreleme ve dışa aktarma davranışları değişmez.

## Yerleşim

- `Yıl` görünümü tek bir `calendar rail` bölümüdür: on iki ay DOM'da kronolojik sırayla yan yana yer alır.
- Her ay kartı sabit okunabilir genişlikte kalır; ekran daraldığında küçülmez, alt satıra geçmez ve dikey kolon düzenine dönüşmez.
- Şerit `overflow-x: auto`, klavye erişimi ve `scroll-snap` kullanır. Başlangıçta seçili günün ayı görünür konuma kaydırılır.
- Masaüstünde seçili gün ayrıntısı şeridin yanında yaklaşık 304 px genişliğinde kalır. Şerit kalan genişlikte bağımsız kayar.
- Mobilde takvim şeridi ana önceliktir. Seçili gün ayrıntısı şeridin altında kompakt bir panel olarak yer alır; bu panel aylık şeridi dikey listeye dönüştürmez.

## Görsel yoğunluk

- Aylık kartlar ince kenarlık, kısa ay başlığı, haftanın gün adları ve eşit gün hücreleri kullanır.
- Etkinlik yoğunluğu hücre içinde renkli nokta/çizgi ve sayısal taşma göstergesiyle iletilir; uzun başlıklar hücre yüksekliğini büyütmez.
- Seçili gün, bugünün günü, hafta sonu ve ay dışı hücreler erişilebilir renk kontrastı ve yalnızca renge dayanmayan görsel işaretlerle ayrılır.
- Yatay akışın fark edilmesi için şeridin sağında kısmi sonraki-ay görünürlüğü, ilk kullanımda kısa açıklama ve uygun kenar boşluğu bulunur.

## Mobil davranış

- Telefonlarda kart genişliği yaklaşık görünür ekranın %85-90'ı olur; bir sonraki ayın kenarı görünerek yatay kaydırma ipucu verir.
- Gün hücrelerinin etkileşim alanı en az 44 x 44 CSS piksel olur. Kaydırma dokunuşu ve gün seçimi çakışmamalıdır.
- Şerit yatay pan hareketini önceliklendirir; kart içindeki gün butonları klavye ve ekran okuyucu için ayrı erişilebilir adlara sahip olur.
- Araç çubuğu yatay taşma yaratmadan iki satırlı, dokunulabilir kontrollerle düzenlenir. Filtre, yenileme, bağlantılar ve dışa aktarma erişilebilir kalır.
- Seçili gün ayrıntısı seçimi takiben görünür alana getirilir, fakat otomatik odak kaydırması yalnızca klavye/yardımcı teknoloji kullanıcısının bağlamını koruyacak biçimde uygulanır.

## Bileşen ve veri sınırları

- Yeni `HorizontalYearRail` yalnızca ayların sırası, görünür konumu ve yatay kaydırma davranışından sorumludur.
- Mevcut `MonthCard`, gün seçimi, etkinlik gruplama, kaynak filtresi, yenileme ve dışa aktarma hesapları korunur; kartın iç görsel yoğunluğu bu bileşende güncellenir.
- `EventDetailPanel` masaüstü yan paneli ve mobil alt paneli için aynı güvenli, kullanıcıya ait seçili-etkinlik verisini kullanır.
- Yıl dışına taşan çok günlü etkinlikler, görünür ay aralıklarında doğru şekilde gösterilmeye devam eder.

## Doğrulama

- Birim testleri: 12 ayın kronolojik tek sıra üretimi, yıl sınırını aşan etkinlik görünürlüğü, seçili ayın ilk yüklemede görünür konuma alınma hesabı ve mobil kart ölçüsü sözleşmesi.
- Bileşen testi: şerit semantiği, gün butonları, taşma göstergeleri ve mobil ayrıntı sırası.
- Playwright: masaüstü ve 390 px mobil genişlikte yatay scroll, ayların alt satıra geçmemesi, seçili gün ayrıntısı ve dokunulabilir kontroller. Kimlik doğrulama koruması testlerde devre dışı bırakılmaz.
