# Tek kullanıcılı magic-link kurulumu

`ALLOWED_EMAIL` sadece bir erken geri bildirim denetimi değildir. Bu uygulama, yalnızca önceden oluşturulmuş izinli Auth kullanıcısına magic link gönderecek şekilde yapılandırılmalıdır.

## Yerel Supabase

Kaynak denetimine alınmış [supabase/config.toml](../supabase/config.toml), global ve e-posta tabanlı yeni kullanıcı kaydını kapatır. Değişiklikten sonra yerel Auth hizmetini yeniden başlatın:

```bash
supabase stop
supabase start
```

## Barındırılan Supabase projesi

Supabase Dashboard → Authentication → Configuration içinde **Allow new users to sign up** ayarını kapatın. Bu dashboard ayarı, `config.toml` ile otomatik olarak uzaktaki projeye taşınmaz; yayın öncesi zorunlu adımdır.

Ardından yalnızca izinli adres için server-only provisioning komutunu, service-role anahtarı bulunan güvenli bir ortamda çalıştırın:

```bash
pnpm provision:allowed-user
```

Komut `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` ve `ALLOWED_EMAIL` ister; service-role anahtarını istemciye yazmaz, loglamaz veya kaynak denetimine eklemez. Başka bir Auth kullanıcısı bulunursa güvenli biçimde durur. Gerekiyorsa bu kullanıcının temizliği Supabase Dashboard'dan ayrı bir operasyon olarak yapılmalıdır.

İstemcideki `signInWithOtp` çağrısı da `shouldCreateUser: false` kullanır. Bu nedenle doğrudan public Auth endpoint'ine yapılan bir istek bile mevcut olmayan bir e-posta için kullanıcı oluşturamaz; signup kapalıyken ve yalnızca bu kullanıcı önceden oluşturulmuşken diğer adreslere magic link gönderilemez.
