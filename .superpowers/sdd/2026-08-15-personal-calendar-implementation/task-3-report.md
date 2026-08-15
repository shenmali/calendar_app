# Task 3 — Magic-link giriş ve korumalı uygulama kabuğu

## Teslim edilenler

- `/login` için erişilebilir Türkçe magic-link formu eklendi. Form, yalnızca `ALLOWED_EMAIL` ile eşleşen adresler için `signInWithOtp` çağırır ve dönüş URL'sini `/auth/callback` olarak ayarlar.
- `/auth/callback`, gelen kodu Supabase oturumuna değiştirir; ardından `getUser()` ile sunucudan kullanıcı kimliğini doğrular. Yetkisiz veya eksik kimlikli kullanıcıların oturumu kapatılır ve `/login?error=unauthorized` adresine yönlendirilir.
- İzinli, doğrulanmış kullanıcılar için `profiles` satırı yalnızca sunucu tarafındaki service-role istemcisiyle upsert edilir. Profil yazımı başarısızsa oturum kapatılır ve erişim verilmez.
- Next.js 15 `middleware.ts`, yalnızca kökteki takvim rotasını korur. `getClaims()` ile doğrulanmış token claim'lerini kontrol eder; cookie içindeki kullanıcı nesnesine güvenmez. Yetkisiz claim'ler için cookie temizlenir ve girişe yönlendirilir.
- Kök sayfa `(calendar)` route group'a taşındı; böylece sonraki takvim ekranı aynı korumalı kabuğu kullanır.

## TDD kaydı

- Callback helper testi önce `@/lib/auth/callback` bulunamadığı için kırmızıydı; yetkisiz yönlendirme için en küçük uygulama eklendi.
- İzinli kullanıcının profil upsert'i, eksik doğrulanmış kullanıcı kimliği ve upsert hatası ayrı kırmızı/yeşil döngülerle eklendi.
- Oturumsuz kök rota Playwright'ta önce `/` üzerinde kaldığı için kırmızıydı; middleware/login ekranı eklendikten sonra yeşil oldu.
- İstemci formundaki yetkisiz e-posta testi, izin denetimi geçici olarak çıkarıldığında beklenen hata metnini bulamadığı için kırmızıydı; denetim geri eklendikten sonra yeşil oldu.

## Doğrulama

Son kalite kapısı, 2026-08-15'te başarıyla çalıştı:

```text
pnpm lint                 # exit 0
pnpm test                 # 6 geçti, 1 önceden var olan RLS testi atlandı
pnpm build                # exit 0
pnpm test:e2e             # 3 geçti
```

Playwright/Next geliştirme sunucusu, `127.0.0.1` kökeni için gelecek sürümde `allowedDevOrigins` ayarı gerekebileceğine dair uyarı verdi; bu işlevsel bir hata değildir ve Task 3 kapsamındaki auth davranışını etkilemedi.

## Güvenlik notları

- Tarayıcı yalnızca `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` kullanır; service-role anahtarı yalnızca sunucu tarafındaki `lib/supabase/admin.ts` içindedir.
- İstemci formu erken geri bildirim sağlar; callback ve middleware aynı izinli e-posta kuralını sunucuda yeniden uygular.
- API/OAuth/cron rotaları middleware'e genişçe dahil edilmedi; bu uçların ileriki görevlerde kendi açık kimlik doğrulama sözleşmelerini uygulamasını korur.
