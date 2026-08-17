# Çok Kullanıcılı Allowlist Tasarımı

## Amaç

Kişisel takvim uygulamasını, yalnızca owner tarafından yönetilen küçük bir kullanıcı grubunun kendi takvimlerini ayrı ayrı kullanabildiği bir uygulamaya dönüştürmek. Kullanıcı ekleme veya erişim kaldırma, Vercel ortam değişkeni ya da yeniden yayın gerektirmeyecek.

## Kapsam

- Owner kullanıcı ekler, erişimi kapatır ve yeniden açar.
- Member kullanıcı yalnızca kendi OAuth bağlantılarını, kaynaklarını, etkinliklerini, eşzamanlama kayıtlarını ve exportlarını görür.
- Yeni kullanıcının Magic Link ile giriş yapabilmesi için Supabase Auth hesabı server-side oluşturulur.
- Erişimi kaldırılan kullanıcının yeni oturum açması engellenir ve aktif oturumları server-side kapatılır; takvim verileri korunur.
- Yalnızca owner, kullanıcı yönetim ekranını ve API'sini kullanabilir.

## Yetkilendirme Modeli

Yeni `public.allowed_users` tablosu aşağıdaki alanları taşır:

- `id uuid`: satır kimliği.
- `user_id uuid unique`: Supabase Auth kullanıcısı; `auth.users(id)` ile ilişkilidir.
- `email text unique`: küçük harfe normalize edilmiş e-posta adresi.
- `role text`: yalnızca `owner` veya `member` değerleri.
- `status text`: yalnızca `active` veya `revoked` değerleri.
- `created_at`, `updated_at`, `revoked_at`: denetim zamanları.

Tablo RLS ile korunur, `anon` ve `authenticated` rollerine doğrudan erişim verilmez. Owner kontrolü, mevcut oturumdan alınan kullanıcı kimliği ile server-side service-role sorgusunun `role = 'owner'` ve `status = 'active'` sonucuna dayanır. Tarayıcıya allowlist ya da rol bilgisi döndürülmez; yalnızca gerekli kullanıcı yönetim görünümü server tarafında oluşturulur.

Mevcut `ALLOWED_EMAIL` çalışma zamanı kontrolü kaldırılır. Giriş callback'i doğrulanmış e-posta ve kullanıcı kimliği için `allowed_users` tablosunda aktif kayıt arar; kayıt yoksa Supabase oturumunu kapatır. Böylece rol değişimi token yenilenmesini beklemeden her korumalı istek ve callback'te server-side uygulanır.

## Başlangıç ve Kullanıcı Yaşam Döngüsü

İlk owner, yalnızca kurulumda kullanılan server-only `OWNER_EMAIL` ile `provision-owner` betiği üzerinden oluşturulur. Betik Supabase Auth kullanıcısını ve eşleşen aktif `owner` allowlist kaydını idempotent şekilde oluşturur. `OWNER_EMAIL` uygulamanın çalışma zamanındaki yetkilendirme kaynağı değildir; bootstrap tamamlandıktan sonra Vercel'de tutulması gerekmez.

Owner yeni bir member eklediğinde server route sırasıyla:

1. E-postayı normalize eder ve geçerli adres olduğunu doğrular.
2. Aynı e-posta için mevcut Auth kullanıcısını bulur veya email-confirmed Auth kullanıcısı oluşturur.
3. `allowed_users` kaydını aktif `member` olarak oluşturur ya da yeniden etkinleştirir.
4. Kullanıcının Magic Link ile giriş yapabileceğini belirtir; erişim talebi veya gizli anahtar hiçbir yanıtta dönmez.

Owner erişimi kapattığında route, `status = 'revoked'` ve `revoked_at` alanlarını günceller, kullanıcının global Supabase oturumlarını kapatır. OAuth bağlantıları ve takvim verileri silinmez. Yeniden etkinleştirme aynı Auth hesabını ve verileri korur.

Owner kendi owner rolünü kaldıramaz veya erişimini kapatamaz. İlk sürümde owner devri yoktur; bu riskli işlem gelecekte açık ve ayrı bir akış olarak tasarlanacaktır.

## Arayüz ve API

`/settings/users` sadece aktif owner için erişilebilir olur. Ekran aktif ve erişimi kapatılmış kullanıcıların e-posta, rol ve durumunu gösterir; member ekleme, revoke ve restore işlemlerini içerir. Bu sayfa ve mutasyon rotaları member için 404/403 döner; veri sızıntısı oluşturmaz.

Sunucu API'si owner-authenticated isteklerden başka bir kullanıcı için işlem kabul etmez. İstemciden gelen `user_id`, `role` veya sahiplik alanları yetkilendirme amacıyla güvenilmez. Kullanıcıların takvim kullanımına ait mevcut RLS ve owner-scoped sorgular değişmeden kalır.

## Doğrulama

Test-first doğrulama şunları kapsar:

- Birden fazla normalize edilmiş e-posta için allowlist eşleşmesi ve geçersiz girişler.
- Aktif member callback'inin profile oluşturabilmesi; revoked veya listede olmayan hesabın oturumunun kapatılması.
- Owner olmayan kullanıcının listeleme, ekleme, revoke ve restore API'lerine erişememesi.
- Owner'ın member ekleyebilmesi, tekrar eklemeyi idempotent biçimde yönetebilmesi, erişimi kapatıp açabilmesi ve kendi erişimini kapatamaması.
- Gerçek local Supabase ortamı mevcutsa RLS/advisor sorguları ve oturum kapatma akışı; yoksa bu entegrasyon doğrulaması açıkça environment-gated olur.
- TypeScript, lint, build ve mevcut Playwright sınırlarıyla birlikte tam test paketi.

## Operasyonel Değişiklikler

- Vercel Production'a geçici bootstrap için `OWNER_EMAIL` eklenir.
- Mevcut `ALLOWED_EMAIL` kaldırılır.
- `SUPABASE_SERVICE_ROLE_KEY` Vercel Production'da bulunmalıdır; kullanıcı yönetimi ve provisioning için server-side gereklidir.
- Supabase Auth'ta yeni kullanıcı kaydı kapalı kalır; yalnızca owner'ın server-side provisioning akışı hesap oluşturabilir.
