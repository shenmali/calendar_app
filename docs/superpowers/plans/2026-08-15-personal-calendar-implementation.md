# Kişisel Takvim Uygulaması Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google Calendar ve Outlook Calendar etkinliklerini salt-okunur olarak eşitleyen, PDF-benzeri yıllık varsayılan görünüme ve ICS/XLSX/CSV dışa aktarmasına sahip, tek kullanıcılı bir web uygulaması oluşturmak.

**Architecture:** Next.js App Router uygulaması Vercel'de çalışır. Supabase, magic-link kimlik doğrulaması, RLS korumalı veriler ve eşitleme geçmişini tutar; Google Calendar API ile Microsoft Graph verileri sunucu tarafındaki sağlayıcı adaptörleriyle ortak etkinlik modeline dönüştürülür. Vercel Cron günlük eşitlemeyi, kullanıcının tetiklediği route handler ise anlık yenilemeyi başlatır.

**Tech Stack:** Next.js (TypeScript, App Router), React, Tailwind CSS, Supabase Auth/Postgres, Vitest, Testing Library, Playwright, Zod, `ical-generator`, SheetJS (`xlsx`), Vercel.

## Global Constraints

- İlk sürüm kesinlikle salt-okunurdur; kaynak takvimlerde oluşturma, düzenleme veya silme yapmaz.
- Arayüz Türkçe, hafta başlangıcı Pazartesi, gösterim saat dilimi `Europe/Istanbul` olmalıdır.
- Yalnızca `ALLOWED_EMAIL` ile magic-link oturumu açılabilir.
- Masaüstünde varsayılan görünüm 12 ayı 3x4 ızgarada birlikte gösterir.
- Google ve Microsoft OAuth yenileme belirteçleri istemciye asla gönderilmez; uygulama gizli anahtarıyla şifrelenmiş olarak tutulur.
- Etkinlik şeması, gelecekte çift yönlü eşitleme için uzak kimlik, uzak sürüm ve son eşitleme alanlarını korur; bu sürümde yazma çağrısı yapmaz.
- Dışa aktarma, aktif tarih aralığı ve kaynak filtrelerini ICS, XLSX ve CSV formatlarına uygular.
- Her görev testini kırmızı-yeşil döngüsüyle tamamlar ve yalnızca o görevin dosyalarını commit eder.

---

## Dosya Yapısı

| Yol | Sorumluluk |
| --- | --- |
| `app/(auth)/login/page.tsx` | Magic-link giriş ekranı |
| `app/auth/callback/route.ts` | Supabase magic-link dönüşü |
| `app/(calendar)/page.tsx` | Kimliği doğrulanmış yıllık takvim ekranı |
| `app/api/connections/*` | Google/Microsoft OAuth başlatma, dönüş ve bağlantı yönetimi |
| `app/api/sync/route.ts` | Kullanıcının tetiklediği eşitleme isteği |
| `app/api/export/[format]/route.ts` | ICS, CSV ve XLSX indirmeleri |
| `app/api/cron/sync/route.ts` | Vercel Cron tarafından çağrılan günlük eşitleme |
| `components/calendar/*` | Yıllık, ay/hafta/gün görünümü, filtreler ve ayrıntı paneli |
| `lib/calendar/*` | Ortak türler, tarih hesapları, görünüm seçicileri ve dışa aktarma saf fonksiyonları |
| `lib/providers/*` | Sağlayıcı sözleşmesi, Google ve Microsoft adaptörleri, eşitleme orkestrasyonu |
| `lib/security/*` | İzinli e-posta denetimi ve token şifreleme |
| `lib/supabase/*` | Tarayıcı ve sunucu Supabase istemcileri |
| `supabase/migrations/*` | Şema, RLS ve indeksler |
| `tests/unit/*` | Saf fonksiyon ve sağlayıcı birim testleri |
| `tests/integration/*` | Route, RLS ve veri erişim testleri |
| `tests/e2e/*` | Arayüz ve kullanıcı akışı Playwright testleri |
| `vercel.json` | Günlük Cron zamanlaması |
| `README.md` | Yerel kurulum, OAuth, Supabase, Vercel ve custom domain rehberi |

## Ortak Sözleşmeler

```ts
// lib/calendar/types.ts
export type CalendarProvider = 'google' | 'microsoft';

export interface CalendarEvent {
  id: string;
  connectionId: string;
  sourceCalendarId: string;
  provider: CalendarProvider;
  remoteEventId: string;
  remoteVersion: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  recurrenceRule: string | null;
  status: 'confirmed' | 'cancelled';
  updatedAt: string;
  lastSyncedAt: string;
}

export interface SyncResult {
  connectionId: string;
  imported: number;
  updated: number;
  removed: number;
  completedAt: string;
}

export interface ProviderConnection {
  id: string;
  userId: string;
  provider: CalendarProvider;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
}

export interface RemoteCalendar { id: string; name: string; isSelected: boolean; }
export interface RemoteEvent { id: string; etag: string | null; status: string; payload: unknown; }
export interface ListEventsInput { connection: ProviderConnection; calendarId: string; range: DateRange; }
export interface NormalizeContext { connection: ProviderConnection; calendarId: string; syncedAt: string; }
export interface DateRange { start: string; end: string; }
export interface MonthModel { month: number; label: string; weeks: Array<Array<{ weekday: string; date: string | null }>>; }
export interface ExportFilters { range: DateRange; connectionIds: string[]; sourceCalendarIds: string[]; }
```

```ts
// lib/providers/types.ts
export interface CalendarProviderClient {
  listCalendars(connection: ProviderConnection): Promise<RemoteCalendar[]>;
  listEvents(input: ListEventsInput): Promise<RemoteEvent[]>;
  normalizeEvent(input: RemoteEvent, context: NormalizeContext): CalendarEvent;
}
```

### Task 1: Uygulama iskeleti ve test altyapısı

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `playwright.config.ts`
- Create: `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `components/ui/button.tsx`
- Create: `tests/unit/smoke.test.ts`, `tests/e2e/landing.spec.ts`, `.env.example`, `.gitignore`

**Interfaces:**
- Produces: Tailwind kullanan Next.js App Router uygulaması; `pnpm test`, `pnpm test:e2e`, `pnpm lint` komutları.

- [ ] **Step 1: Paket komutlarını ve çalışma zamanını tanımla.**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 2: Kırmızı smoke testi yaz.**

```ts
import { expect, test } from 'vitest';
import { appName } from '@/lib/app-config';

test('uygulama adı Takvim olur', () => {
  expect(appName).toBe('Takvim');
});
```

- [ ] **Step 3: Testin önce başarısız olduğunu doğrula.**

Run: `pnpm test tests/unit/smoke.test.ts`  
Expected: FAIL; `@/lib/app-config` bulunamaz.

- [ ] **Step 4: `lib/app-config.ts` içinde `export const appName = 'Takvim'` tanımını, kök layout'u ve erişilebilir temel stilleri ekle.**

- [ ] **Step 5: Birim testini, lint'i ve üretim derlemesini doğrula.**

Run: `pnpm test tests/unit/smoke.test.ts && pnpm lint && pnpm build`  
Expected: üç komut exit code 0.

- [ ] **Step 6: Commit et.**

```bash
git add package.json app components lib tests .env.example .gitignore next.config.ts tsconfig.json tailwind.config.ts postcss.config.mjs vitest.config.ts playwright.config.ts
git commit -m "feat: scaffold calendar application"
```

### Task 2: Supabase şeması, RLS ve tek-kullanıcı erişimi

**Files:**
- Create: `supabase/migrations/202608150001_initial_schema.sql`
- Create: `lib/supabase/server.ts`, `lib/supabase/browser.ts`, `lib/security/allowed-email.ts`
- Create: `tests/integration/allowed-email.test.ts`, `tests/integration/rls-policies.test.ts`

**Interfaces:**
- Produces: `profiles`, `oauth_connections`, `calendar_sources`, `calendar_events`, `sync_runs` tabloları; `isAllowedEmail(email)` fonksiyonu.

- [ ] **Step 1: E-posta denetimi için kırmızı test yaz.**

```ts
import { expect, test } from 'vitest';
import { isAllowedEmail } from '@/lib/security/allowed-email';

test('yalnızca izinli e-posta kabul edilir', () => {
  expect(isAllowedEmail('owner@example.com', 'owner@example.com')).toBe(true);
  expect(isAllowedEmail('other@example.com', 'owner@example.com')).toBe(false);
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula.**

Run: `pnpm test tests/integration/allowed-email.test.ts`  
Expected: FAIL; modül bulunamaz.

- [ ] **Step 3: Migration'ı uygula.** `profiles(id uuid primary key references auth.users, email text unique not null)`, bağlantı/sources/event/sync tablosu ve aşağıdaki zorunlu benzersiz indeksleri ekle:

```sql
create unique index calendar_events_remote_key
on public.calendar_events (connection_id, remote_event_id);
create unique index calendar_sources_remote_key
on public.calendar_sources (connection_id, remote_calendar_id);
```

Her tabloda RLS'i etkinleştir; `auth.uid() = user_id` koşuluyla select politikası oluştur. `oauth_connections` için istemciye doğrudan select politikası oluşturma; yalnızca service-role kullanan sunucu yolları token alanına erişsin.

- [ ] **Step 4: `isAllowedEmail` fonksiyonunu boşluk/küçük-büyük harf güvenli olacak şekilde uygula ve sunucu/tarayıcı Supabase istemcilerini tanımla.**

```ts
export function isAllowedEmail(email: string, allowedEmail: string) {
  return email.trim().toLocaleLowerCase('en-US') ===
    allowedEmail.trim().toLocaleLowerCase('en-US');
}
```

- [ ] **Step 5: RLS testinde ikinci bir kullanıcının event ve connection satırlarını okuyamadığını; izinli kullanıcının kendi eventini okuyabildiğini doğrula.**

Run: `pnpm test tests/integration/allowed-email.test.ts tests/integration/rls-policies.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit et.**

```bash
git add supabase lib/supabase lib/security tests/integration
git commit -m "feat: add secure calendar data model"
```

### Task 3: Magic-link giriş ve korumalı uygulama kabuğu

**Files:**
- Create: `app/(auth)/login/page.tsx`, `app/auth/callback/route.ts`, `app/(calendar)/layout.tsx`, `middleware.ts`
- Create: `components/auth/login-form.tsx`, `tests/integration/auth-callback.test.ts`, `tests/e2e/auth-guard.spec.ts`

**Interfaces:**
- Consumes: `isAllowedEmail`, Supabase sunucu istemcisi.
- Produces: Oturum yokken `/login` yönlendirmesi; izinli adrese magic-link gönderimi.

- [ ] **Step 1: Kırmızı callback testini yaz.**

```ts
test('izin verilmeyen e-posta callback sonrası çıkışa yönlendirilir', async () => {
  const response = await handleAuthCallback({ email: 'other@example.com' });
  expect(response.headers.get('location')).toContain('/login?error=unauthorized');
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula.**

Run: `pnpm test tests/integration/auth-callback.test.ts`  
Expected: FAIL; `handleAuthCallback` tanımlı değildir.

- [ ] **Step 3: Callback'te code exchange yap, kullanıcı e-postasını `ALLOWED_EMAIL` ile doğrula, izin yoksa Supabase oturumunu kapat; izin varsa profile satırını upsert et.**

- [ ] **Step 4: Login formuna e-posta alanı ve `signInWithOtp` çağrısı ekle; hem formda hem sunucu callback'inde izinli e-posta kontrolü uygula. Middleware ile `(calendar)` rotalarını koru.**

- [ ] **Step 5: Birim/entegrasyon ve Playwright guard testlerini doğrula.**

Run: `pnpm test tests/integration/auth-callback.test.ts && pnpm test:e2e tests/e2e/auth-guard.spec.ts`  
Expected: PASS.

- [ ] **Step 6: Commit et.**

```bash
git add app components middleware.ts tests
git commit -m "feat: add single-user magic link access"
```

### Task 4: OAuth bağlantıları ve şifreli token saklama

**Files:**
- Create: `lib/security/token-crypto.ts`, `lib/providers/types.ts`, `lib/providers/oauth-state.ts`
- Create: `app/api/connections/google/start/route.ts`, `app/api/connections/google/callback/route.ts`
- Create: `app/api/connections/microsoft/start/route.ts`, `app/api/connections/microsoft/callback/route.ts`, `app/api/connections/route.ts`, `app/api/connections/[id]/route.ts`
- Create: `tests/unit/token-crypto.test.ts`, `tests/integration/oauth-state.test.ts`, `tests/integration/connections-route.test.ts`

**Interfaces:**
- Produces: `encryptToken(plain: string): string`, `decryptToken(cipher: string): string`, bağlantı listesi/bağlantı kaldırma API'si; `ProviderConnection` türü.

- [ ] **Step 1: AES-GCM şifreleme için kırmızı test yaz.**

```ts
test('token şifreleme geri çözülebilir ve düz metni saklamaz', () => {
  const encrypted = encryptToken('refresh-secret');
  expect(encrypted).not.toContain('refresh-secret');
  expect(decryptToken(encrypted)).toBe('refresh-secret');
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula.**

Run: `pnpm test tests/unit/token-crypto.test.ts`  
Expected: FAIL; `encryptToken` bulunamaz.

- [ ] **Step 3: `TOKEN_ENCRYPTION_KEY` için 32-byte base64 anahtar zorunlu kılan AES-256-GCM yardımcı fonksiyonlarını uygula.** Şifreli değer `base64(iv).base64(tag).base64(ciphertext)` biçiminde olsun; anahtar veya biçim yanlışsa kontrollü hata at.

- [ ] **Step 4: Google için authorization-code/refresh-token akışını, Microsoft için Graph `Calendars.Read` yetkili authorization-code akışını uygula.** OAuth state içine kullanıcı kimliği, sağlayıcı ve kısa son kullanım süresi içeren imzalı nonce koy; callback'te state'i bir kez tüket. Sadece sunucu tarafı, şifreli tokenı `oauth_connections` tablosuna yazabilir.

- [ ] **Step 5: Bağlantı listeleme rota çıktısında token alanlarının hiç bulunmadığını test et; bağlantı silme rotasının seçili sources/events satırlarını da kaldırdığını test et.**

Run: `pnpm test tests/unit/token-crypto.test.ts tests/integration/oauth-state.test.ts tests/integration/connections-route.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit et.**

```bash
git add app/api/connections lib/security lib/providers tests
git commit -m "feat: add secure calendar connections"
```

### Task 5: Google/Microsoft okuma adaptörleri ve eşitleme orkestrasyonu

**Files:**
- Create: `lib/calendar/types.ts`, `lib/calendar/time.ts`
- Create: `lib/providers/google.ts`, `lib/providers/microsoft.ts`, `lib/providers/sync.ts`
- Create: `tests/unit/google-provider.test.ts`, `tests/unit/microsoft-provider.test.ts`, `tests/unit/sync.test.ts`

**Interfaces:**
- Consumes: `CalendarProviderClient`, şifre çözücü, `CalendarEvent`.
- Produces: `syncConnection(connectionId: string, range: DateRange): Promise<SyncResult>`.

- [ ] **Step 1: Google normalleştirmesi için kırmızı test yaz.**

```ts
expect(normalizeGoogleEvent(allDayEvent, context)).toMatchObject({
  provider: 'google', isAllDay: true, startsAt: '2026-08-15',
  remoteEventId: 'g-42', status: 'confirmed'
});
```

- [ ] **Step 2: Microsoft tekrarlayan/saatli etkinlik ve iptal edilmiş Google etkinliği için eşdeğer kırmızı testler yaz.**

```ts
expect(normalizeMicrosoftEvent(timedRecurringEvent, context).recurrenceRule).toContain('RRULE:');
expect(normalizeGoogleEvent(cancelledEvent, context).status).toBe('cancelled');
```

- [ ] **Step 3: Testlerin başarısız olduğunu doğrula.**

Run: `pnpm test tests/unit/google-provider.test.ts tests/unit/microsoft-provider.test.ts tests/unit/sync.test.ts`  
Expected: FAIL; sağlayıcı modülleri yok.

- [ ] **Step 4: Her adaptörde yalnızca listeleme çağrısı yap; Google Events API ve Microsoft Graph calendarView yanıtlarını ortak türe dönüştür.** Tüm gün değerlerini tarih olarak, saatli değerleri ISO timestamp olarak koru; ekran dönüşümünü `Europe/Istanbul` görünüm katmanına bırak.

- [ ] **Step 5: Orkestratörde kaynak seçimlerini yükle, uzak etkinlikleri upsert et, uzaktan kaldırılan etkinlikleri iptal et ve `sync_runs` satırını `success` veya `failed` durumuyla bitir.** `remote_event_id`, `remote_version` ve `last_synced_at` alanlarını her yazmada güncelle; hiçbir sağlayıcıya POST/PATCH/DELETE isteği gönderme.

- [ ] **Step 6: Testleri çalıştır.**

Run: `pnpm test tests/unit/google-provider.test.ts tests/unit/microsoft-provider.test.ts tests/unit/sync.test.ts`  
Expected: PASS; HTTP mockları yalnızca GET istekleri görür.

- [ ] **Step 7: Commit et.**

```bash
git add lib/calendar lib/providers tests/unit
git commit -m "feat: sync Google and Microsoft calendars"
```

### Task 6: Günlük Cron ve elle yenileme

**Files:**
- Create: `app/api/sync/route.ts`, `app/api/cron/sync/route.ts`, `lib/providers/sync-lock.ts`, `vercel.json`
- Create: `supabase/migrations/202608150002_sync_locks.sql`
- Create: `tests/integration/manual-sync-route.test.ts`, `tests/integration/cron-sync-route.test.ts`, `tests/unit/sync-lock.test.ts`

**Interfaces:**
- Consumes: `syncConnection`.
- Produces: `POST /api/sync` ve `GET /api/cron/sync`; `acquireSyncLock(userId): Promise<boolean>`.

- [ ] **Step 1: Aynı kullanıcı için ikinci elle yenilemenin 409 döndüğünü gösteren kırmızı test yaz.**

```ts
expect(await requestManualSync({ alreadyRunning: true })).toMatchObject({ status: 409 });
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula.**

Run: `pnpm test tests/integration/manual-sync-route.test.ts tests/unit/sync-lock.test.ts`  
Expected: FAIL; route ve lock modülü yok.

- [ ] **Step 3: `sync_locks` tablosuna kullanıcı başına benzersiz satır ve son kullanım zamanı ekleyen migration yaz; atomik ekleme ile lock al, finally bloğunda serbest bırak.**

- [ ] **Step 4: Elle yenileme rotasında kullanıcıyı doğrula, lock al, yalnızca kullanıcının etkin bağlantılarını eşitle ve `202 Accepted` ile sonuç özetini dön. Cron rotasında `Authorization: Bearer ${CRON_SECRET}` doğrulaması yapıp tüm aktif bağlantıları eşitle.**

- [ ] **Step 5: `vercel.json` içine her gün 03:15 UTC çalışacak cron ekle.**

```json
{ "crons": [{ "path": "/api/cron/sync", "schedule": "15 3 * * *" }] }
```

- [ ] **Step 6: Başarı, 409, yetkisiz cron ve bir sağlayıcının hatasında diğer bağlantının devamı senaryolarını doğrula.**

Run: `pnpm test tests/integration/manual-sync-route.test.ts tests/integration/cron-sync-route.test.ts tests/unit/sync-lock.test.ts`  
Expected: PASS.

- [ ] **Step 7: Commit et.**

```bash
git add app/api/sync app/api/cron lib/providers supabase/migrations vercel.json tests
git commit -m "feat: add scheduled and manual sync"
```

### Task 7: PDF-benzeri yıllık takvim, filtreler ve ayrıntı paneli

**Files:**
- Create: `app/(calendar)/page.tsx`, `components/calendar/year-grid.tsx`, `components/calendar/month-card.tsx`, `components/calendar/day-cell.tsx`, `components/calendar/event-detail-panel.tsx`, `components/calendar/calendar-toolbar.tsx`, `components/calendar/source-filter.tsx`
- Create: `lib/calendar/year-grid.ts`, `lib/calendar/event-selectors.ts`
- Create: `tests/unit/year-grid.test.ts`, `tests/unit/event-selectors.test.ts`, `tests/e2e/year-view.spec.ts`

**Interfaces:**
- Consumes: `CalendarEvent`.
- Produces: `buildYearMonths(year: number, weekStartsOn: 1): MonthModel[]`, `selectEvents(filters): CalendarEvent[]`.

- [ ] **Step 1: 2026 yılı için 12 ayın Pazartesi başlangıçlı üretildiğini doğrulayan kırmızı test yaz.**

```ts
const months = buildYearMonths(2026, 1);
expect(months).toHaveLength(12);
expect(months[0].weeks[0][0].weekday).toBe('Pzt');
```

- [ ] **Step 2: Bir gün hücresinin ilk iki etkinliği ve kalan `+N` sayacını döndürdüğünü test et.**

```ts
expect(eventsForDay(fiveEvents)).toEqual({ visible: fiveEvents.slice(0, 2), remaining: 3 });
```

- [ ] **Step 3: Testlerin başarısız olduğunu doğrula.**

Run: `pnpm test tests/unit/year-grid.test.ts tests/unit/event-selectors.test.ts`  
Expected: FAIL; model/selector yok.

- [ ] **Step 4: Saf tarih modelini ve filtre seçicilerini uygula.** Filtreler yıl, tarih aralığı, bağlantı ve kaynak takvim kimliği almalı; görünüm katmanından bağımsız olmalı.

- [ ] **Step 5: 3x4 CSS grid, ay kartları, en fazla iki kısa etiket + `+N`, kaynak rengi ve sağda seçili gün ayrıntı panelini uygula.** Üst çubuk yıl seçici, Bugün, kaynak filtresi, Yenile düğmesi, son eşitleme zamanı ve dışa aktarma menüsü alanını içersin. `Yeni Etkinlik` düğmesi ekleme.

- [ ] **Step 6: Masaüstü Playwright testinde 12 başlığı, seçili günün ayrıntı panelini ve `Yeni Etkinlik` metninin bulunmadığını doğrula.**

Run: `pnpm test tests/unit/year-grid.test.ts tests/unit/event-selectors.test.ts && pnpm test:e2e tests/e2e/year-view.spec.ts`  
Expected: PASS.

- [ ] **Step 7: Commit et.**

```bash
git add app components/calendar lib/calendar tests
git commit -m "feat: add annual calendar view"
```

### Task 8: Ay/hafta/gün görünümleri, responsive davranış ve bağlantı ayarları

**Files:**
- Create: `components/calendar/view-switcher.tsx`, `components/calendar/month-view.tsx`, `components/calendar/week-view.tsx`, `components/calendar/day-view.tsx`, `components/calendar/connections-dialog.tsx`
- Create: `tests/e2e/calendar-views.spec.ts`, `tests/e2e/responsive-year-view.spec.ts`, `tests/e2e/connections.spec.ts`

**Interfaces:**
- Consumes: `CalendarEvent`, bağlantı API'si.
- Produces: `CalendarView = 'year' | 'month' | 'week' | 'day'`; `useCalendarView()`.

- [ ] **Step 1: Varsayılanın `year` olduğunu ve görünüm değiştiricinin ay/hafta/gün modlarına geçtiğini doğrulayan kırmızı Playwright testini yaz.**

```ts
await expect(page.getByTestId('year-grid')).toBeVisible();
await page.getByRole('button', { name: 'Hafta' }).click();
await expect(page.getByTestId('week-view')).toBeVisible();
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula.**

Run: `pnpm test:e2e tests/e2e/calendar-views.spec.ts`  
Expected: FAIL; görünüm seçici yok.

- [ ] **Step 3: Görünüm state'ini URL search parametresinde tut; yıllık görünümü varsayılan yap.** Ay/hafta/gün bileşenleri aynı filtrelenmiş event koleksiyonunu tüketmelidir.

- [ ] **Step 4: Responsive CSS ekle.** `min-width: 1280px` için 3 sütun; 768-1279px için 2 sütun; altında tek sütun. Dar hücrede başlık yerine kaynak renk noktası ve toplam sayaç göster; dokunma hedefleri en az 44px olsun.

- [ ] **Step 5: Bağlantılar dialogunda Google ve Outlook bağlama düğmeleri, seçili takvim checkbox'ları, bağlantıyı kaldırma ve izin süresi dolmuş hata durumu ekle.** Token veya gizli değer UI'a sızmamalıdır.

- [ ] **Step 6: Görünüm, mobil viewport ve bağlantı UI testlerini çalıştır.**

Run: `pnpm test:e2e tests/e2e/calendar-views.spec.ts tests/e2e/responsive-year-view.spec.ts tests/e2e/connections.spec.ts`  
Expected: PASS.

- [ ] **Step 7: Commit et.**

```bash
git add components tests/e2e
git commit -m "feat: add responsive calendar navigation"
```

### Task 9: ICS, CSV ve XLSX dışa aktarma

**Files:**
- Create: `lib/export/ics.ts`, `lib/export/csv.ts`, `lib/export/xlsx.ts`, `lib/export/types.ts`
- Create: `app/api/export/[format]/route.ts`, `components/calendar/export-menu.tsx`
- Create: `tests/unit/export-ics.test.ts`, `tests/unit/export-csv.test.ts`, `tests/unit/export-xlsx.test.ts`, `tests/integration/export-route.test.ts`

**Interfaces:**
- Consumes: `CalendarEvent[]`, `ExportFilters`.
- Produces: `createIcs(events): string`, `createCsv(events): string`, `createXlsx(events): Uint8Array`.

- [ ] **Step 1: ICS içerik testi yaz.**

```ts
const ics = createIcs([timedEvent, allDayEvent]);
expect(ics).toContain('BEGIN:VCALENDAR');
expect(ics).toContain('UID:google:g-42');
expect(ics).toContain('VALUE=DATE:20260815');
```

- [ ] **Step 2: CSV sütun sırası ve XLSX sayfa başlığı için kırmızı testler yaz.**

```ts
expect(createCsv([timedEvent]).split('\n')[0]).toBe('Başlık,Başlangıç,Bitiş,Tüm Gün,Konum,Kaynak');
expect(readWorkbook(createXlsx([timedEvent])).SheetNames).toEqual(['Etkinlikler']);
```

- [ ] **Step 3: Testlerin başarısız olduğunu doğrula.**

Run: `pnpm test tests/unit/export-ics.test.ts tests/unit/export-csv.test.ts tests/unit/export-xlsx.test.ts`  
Expected: FAIL; export modülleri yok.

- [ ] **Step 4: Üç üreticiyi uygula.** ICS UID'si `{provider}:{remoteEventId}` olsun; CSV UTF-8 BOM içersin; XLSX sütunları Başlık, Başlangıç, Bitiş, Tüm Gün, Konum, Kaynak, Takvim, Açıklama olsun.

- [ ] **Step 5: Route'ta oturumu doğrula, sorgu parametrelerini Zod ile doğrula, kullanıcının filtrelenmiş olaylarını sorgula ve doğru `Content-Type`/`Content-Disposition` ile dosyayı döndür.** Geçersiz format için 404, geçersiz tarih aralığı için 400 dön.

- [ ] **Step 6: Formatların, kaynak filtresinin ve tarih aralığının route testini çalıştır.**

Run: `pnpm test tests/unit/export-ics.test.ts tests/unit/export-csv.test.ts tests/unit/export-xlsx.test.ts tests/integration/export-route.test.ts`  
Expected: PASS.

- [ ] **Step 7: Commit et.**

```bash
git add app/api/export components/calendar lib/export tests
git commit -m "feat: export calendar data"
```

### Task 10: Canlıya alma, güvenlik doğrulaması ve operasyon rehberi

**Files:**
- Create: `docs/deployment.md`, `docs/oauth-setup.md`
- Modify: `README.md`, `.env.example`, `vercel.json`
- Create: `tests/e2e/full-flow.spec.ts`

**Interfaces:**
- Consumes: Tüm önceki rotalar, environment değişkenleri.
- Produces: Tekrarlanabilir Vercel/Supabase/OAuth/custom-domain yayın rehberi ve canlı öncesi test akışı.

- [ ] **Step 1: Kırmızı uçtan uca test yaz.**

```ts
test('yıllık görünümden filtrelenmiş CSV indirimi', async ({ page }) => {
  await loginAsAllowedUser(page);
  await page.getByRole('button', { name: 'Dışa Aktar' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/takvim-.*\.csv/);
});
```

- [ ] **Step 2: Testin başarısız olduğunu doğrula.**

Run: `pnpm test:e2e tests/e2e/full-flow.spec.ts`  
Expected: FAIL; tam akış henüz çalışmıyor veya eksik environment bildiriyor.

- [ ] **Step 3: `.env.example` içine her değeri açıklayan şu isimleri ekle:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_EMAIL`, `TOKEN_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`.

- [ ] **Step 4: `docs/oauth-setup.md` içinde Google Cloud ve Microsoft Entra uygulamalarında gerekli redirect URI'leri (`/api/connections/google/callback`, `/api/connections/microsoft/callback`) ve salt-okunur izinleri; `docs/deployment.md` içinde Supabase migration, Vercel environment, Cron, domain ve Supabase Auth redirect URL kurulumunu yaz.**

- [ ] **Step 5: Canlı öncesi testleri ve tam kalite kapısını çalıştır.**

Run: `pnpm lint && pnpm test && pnpm build && pnpm test:e2e`  
Expected: tüm komutlar exit code 0.

- [ ] **Step 6: Vercel preview dağıtımında gerçek magic-link, bir Google bağlantısı, bir Microsoft bağlantısı, elle yenileme, Cron kimliği ve üç dışa aktarma dosyasını doğrula.** Her sağlayıcıda yalnızca GET/okuma erişimi kullanıldığını API audit loglarından kontrol et.

- [ ] **Step 7: Commit et.**

```bash
git add README.md .env.example vercel.json docs tests/e2e
git commit -m "docs: add deployment and operations guide"
```

## Plan Öz İncelemesi

### Kapsam eşlemesi

- Tek kullanıcı magic-link ve RLS: Task 2-3.
- Google/Outlook bağlantısı, token güvenliği ve takvim seçimi: Task 4, Task 8.
- Salt-okunur iki sağlayıcı eşitlemesi, günde bir Cron ve elle yenileme: Task 5-6.
- PDF-benzeri 12 aylık varsayılan düzen, ayrıntı paneli, ikincil görünümler ve responsive davranış: Task 7-8.
- ICS/XLSX/CSV dışa aktarma: Task 9.
- Vercel, custom domain, Supabase, OAuth ve canlı doğrulama: Task 10.
- Gelecek çift yönlü senkron için uzaktan kimlik/sürüm alanları: Task 2 ve Task 5.

### Yer tutucu ve tür denetimi

- Plan; her implementasyon görevi için dosya yolları, üretilen arayüz, kırmızı test, komut ve commit mesajı içerir.
- `CalendarEvent`, `CalendarProviderClient`, `SyncResult`, `syncConnection`, `isAllowedEmail` ve export üretici imzaları tanımlanmış ve sonraki görevlerde aynı isimle kullanılmıştır.
- İlk sürümde kaynaklara yazma yapan hiçbir route veya adaptör adımı yoktur.
