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
- Fix round 1 sonrasında middleware, auth ve Next statik istisnaları dışındaki tüm uygulama yollarını korur.

## Fix round 1 (inceleme bulguları)

- `signInWithOtp` artık `shouldCreateUser: false` ile çağrılır. `supabase/config.toml`, yerel Auth'ta hem genel hem e-posta tabanlı kayıt oluşturmayı kapatır. Bu nedenle doğrudan public Auth isteği, mevcut olmayan bir e-posta için kullanıcı oluşturamaz.
- `pnpm provision:allowed-user`, `ALLOWED_EMAIL` kullanıcısını yalnızca service-role anahtarı bulunan sunucu ortamında önceden oluşturur. Tek kullanıcı kuralını ihlal eden mevcut Auth kullanıcıları bulunursa komut durur. Barındırılan Supabase projesinde Dashboard'daki **Allow new users to sign up** ayarı da yayın öncesinde kapatılmalıdır; bu dış sağlayıcı ayarı repo tarafından otomatik taşınamaz.
- `tests/integration/auth-callback-route.test.ts`, gerçek callback route modülünü Supabase sınırında mocklayarak kod değişimi, `getUser`, yetkisiz kullanıcı için sign-out ve izinli profil upsert bağlantısını kapsar.
- Middleware artık `/login`, `/auth/callback`, `/_next/static`, `/_next/image` ve `/favicon.ico` hariç tüm uygulama yollarını korur. `/settings` için oturumsuz yönlendirme Playwright ile doğrulandı.

### Fix round 1 doğrulaması

```text
pnpm lint
pnpm test tests/unit/magic-link.test.ts tests/integration/auth-callback.test.ts tests/integration/auth-callback-route.test.ts  # 8 geçti
pnpm test:e2e tests/e2e/auth-guard.spec.ts  # 3 geçti
pnpm build
```
