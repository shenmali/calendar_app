# Çok Kullanıcılı Allowlist Uygulama Planı

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner tarafından yönetilen bir allowlist ile birden fazla kullanıcının kendi takvimlerini birbirinden izole biçimde kullanmasını sağlamak.

**Architecture:** `allowed_users` Auth kullanıcı kimliği, normalize e-posta, rol ve erişim durumunu tutar. Callback ve yönetim API'leri server-side service-role üzerinden kayıtları doğrular; browser tabloya doğrudan erişemez. İlk owner bootstrap betiğiyle oluşur, owner da settings ekranından member ekler/revoke eder/geri açar.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Auth/Postgres/RLS, Vitest, Playwright, Vercel.

## Global Constraints

- Tablo RLS etkin, `anon` ve `authenticated` için kapalıdır.
- Roller `owner`/`member`; durumlar `active`/`revoked` ile sınırlıdır.
- E-posta `trim().toLocaleLowerCase('en-US')` ile normalize edilir.
- `OWNER_EMAIL` yalnızca bootstrap değişkenidir; runtime yetkilendirme kaynağı değildir.
- Revoke veriyi silmez; yeni girişleri ve aktif oturumları kapatır.
- Owner kendi erişimini ve owner rolünü değiştiremez.
- Her üretim değişikliğinden önce failing test koşulur.

---

### Task 1: Allowlist şeması ve saf yardımcılar

**Files:**
- Create: `supabase/migrations/<timestamp>_add_allowed_users.sql`
- Create: `lib/access/allowed-users.ts`
- Test: `tests/unit/allowed-users.test.ts`

**Interfaces:**
- Produces: `normalizeEmail(email: string): string`.
- Produces: `isActiveAllowedUser(row: { status: string }): boolean`.
- Produces: `isOwner(row: { role: string; status: string }): boolean`.

- [ ] **Step 1: Write failing tests**

```ts
import { expect, test } from 'vitest';
import { isActiveAllowedUser, isOwner, normalizeEmail } from '@/lib/access/allowed-users';

test('normalizes allowlist email', () => {
  expect(normalizeEmail('  OWNER@Example.COM ')).toBe('owner@example.com');
});

test('allows only active records', () => {
  expect(isActiveAllowedUser({ status: 'active' })).toBe(true);
  expect(isActiveAllowedUser({ status: 'revoked' })).toBe(false);
});

test('recognizes only active owner', () => {
  expect(isOwner({ role: 'owner', status: 'active' })).toBe(true);
  expect(isOwner({ role: 'member', status: 'active' })).toBe(false);
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test tests/unit/allowed-users.test.ts`

Expected: FAIL because `lib/access/allowed-users.ts` does not exist.

- [ ] **Step 3: Implement minimum helpers**

```ts
export const normalizeEmail = (email: string) => email.trim().toLocaleLowerCase('en-US');
export const isActiveAllowedUser = (row: { status: string }) => row.status === 'active';
export const isOwner = (row: { role: string; status: string }) =>
  row.role === 'owner' && isActiveAllowedUser(row);
```

- [ ] **Step 4: Verify GREEN**

Run: `pnpm test tests/unit/allowed-users.test.ts`

Expected: PASS.

- [ ] **Step 5: Create and apply reviewed migration**

Run: `pnpm dlx supabase migration new add_allowed_users`

Create `public.allowed_users` with unique Auth `user_id`, unique normalized `email`, checked role/status, audit timestamps, `revoked_at`, active-email index, RLS, revoked client grants, and service-role-only CRUD grants. Apply exact SQL using `mcp__codex_apps__supabase_apply_migration`; verify RLS/table/advisors afterward.

- [ ] **Step 6: Commit**

Run: `git add supabase/migrations/<timestamp>_add_allowed_users.sql lib/access/allowed-users.ts tests/unit/allowed-users.test.ts`

Run: `git commit -m "feat: add managed user allowlist"`

### Task 2: Callback ve bootstrap'ı allowlist'e geçir

**Files:**
- Modify: `lib/auth/callback.ts`
- Modify: `app/auth/callback/route.ts`
- Replace: `scripts/provision-allowed-user.mjs` with `scripts/provision-owner.mjs`
- Modify: `package.json`, `.env.example`, `scripts/deployment-preflight.mjs`
- Test: `tests/integration/auth-callback.test.ts`
- Test: `tests/integration/auth-callback-route.test.ts`
- Test: `tests/unit/deployment-preflight.test.ts`

**Interfaces:**
- `handleAuthCallback` consumes `findActiveAllowedUser({ userId, email }): Promise<boolean>`.
- `provision:owner` consumes `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OWNER_EMAIL`.

- [ ] **Step 1: Write failing callback tests**

```ts
test('active member callback writes profile', async () => {
  const response = await handleAuthCallback({
    userId, email: 'member@example.com', findActiveAllowedUser: async () => true,
    signOut: async () => { throw new Error('unexpected sign out'); }, upsertProfile: saveProfile,
  });
  expect(response.headers.get('location')).toBe('http://localhost/');
});

test('revoked callback signs out', async () => {
  let signedOut = false;
  const response = await handleAuthCallback({
    userId, email: 'member@example.com', findActiveAllowedUser: async () => false,
    signOut: async () => { signedOut = true; },
  });
  expect(signedOut).toBe(true);
  expect(response.headers.get('location')).toContain('error=unauthorized');
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test tests/integration/auth-callback.test.ts tests/integration/auth-callback-route.test.ts`

Expected: FAIL because callback has no allowlist lookup contract.

- [ ] **Step 3: Implement callback authorization**

Replace `allowedEmail` with injected active lookup. The route queries `allowed_users` after Auth `getUser`, using authenticated `user_id`, normalized e-mail, and `status = 'active'`; only then upserts the profile. Any missing/false/error lookup signs out. Request body, user metadata, and environment email are never authorization inputs.

- [ ] **Step 4: Verify GREEN**

Run: `pnpm test tests/integration/auth-callback.test.ts tests/integration/auth-callback-route.test.ts`

Expected: PASS, including existing exchange/profile failure cases.

- [ ] **Step 5: Write failing bootstrap/preflight tests**

Replace test fixture `ALLOWED_EMAIL` with `OWNER_EMAIL`. Add a provisioning seam test that reuses existing Auth users and upserts active owner membership.

- [ ] **Step 6: Implement `provision-owner.mjs`**

Normalize `OWNER_EMAIL`; find or create `email_confirm: true` Auth user; upsert `{ user_id, email, role: 'owner', status: 'active', revoked_at: null }`. Never reject other users, delete data, or print e-mail/secrets. Rename package script to `provision:owner`, remove runtime `ALLOWED_EMAIL` use, and update env/preflight documentation.

- [ ] **Step 7: Verify and commit**

Run: `pnpm test tests/unit/deployment-preflight.test.ts tests/integration/auth-callback.test.ts tests/integration/auth-callback-route.test.ts`

Expected: PASS.

Run: `git add lib/auth/callback.ts app/auth/callback/route.ts scripts/provision-owner.mjs scripts/deployment-preflight.mjs package.json .env.example tests/integration/auth-callback.test.ts tests/integration/auth-callback-route.test.ts tests/unit/deployment-preflight.test.ts`

Run: `git rm scripts/provision-allowed-user.mjs`

Run: `git commit -m "feat: authorize magic links with managed members"`

### Task 3: Owner-only kullanıcı yönetim API'si

**Files:**
- Create: `lib/access/owner-guard.ts`
- Create: `app/api/users/route.ts`
- Create: `app/api/users/[id]/route.ts`
- Test: `tests/integration/user-management-routes.test.ts`

**Interfaces:**
- Produces: `requireActiveOwner(): Promise<{ userId: string }>`.
- `GET /api/users` returns safe member projections.
- `POST /api/users` accepts `{ email: string }`.
- `PATCH /api/users/[id]` accepts `{ status: 'active' | 'revoked' }`.

- [ ] **Step 1: Write failing route tests**

```ts
test('member cannot list users', async () => {
  mockOwnerLookup(false);
  expect((await GET(request)).status).toBe(403);
});

test('owner adds normalized member without credentials', async () => {
  mockOwnerLookup(true);
  const response = await POST(jsonRequest({ email: ' Member@Example.com ' }));
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual(expect.objectContaining({ email: 'member@example.com' }));
});

test('owner cannot revoke self', async () => {
  mockOwnerLookup(true);
  expect((await PATCH(jsonRequest({ status: 'revoked' }), { params: { id: ownerRowId } })).status).toBe(400);
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test tests/integration/user-management-routes.test.ts`

Expected: FAIL because owner guard/routes do not exist.

- [ ] **Step 3: Implement owner guard and routes**

Guard validates session with SSR client, then service-role queries active owner membership by user id. Return 401 without session, 403 for member. `POST` Zod-validates a single e-mail, finds/creates email-confirmed Auth user, then upserts active member. `PATCH` disallows current owner and all owner rows, revokes by status/time update plus global Auth sign-out, and restores by active status/null revoke time. Responses expose only `id`, `email`, `role`, `status`, `created_at`, `revoked_at`; no Auth IDs, token fields, or secrets.

- [ ] **Step 4: Verify GREEN and commit**

Run: `pnpm test tests/integration/user-management-routes.test.ts`

Expected: PASS for unauthorized/member denial, idempotent add, self protection, revoke, restore.

Run: `git add lib/access/owner-guard.ts app/api/users/route.ts app/api/users/[id]/route.ts tests/integration/user-management-routes.test.ts`

Run: `git commit -m "feat: add owner-only member management"`

### Task 4: Owner ayar ekranı ve dokümantasyon

**Files:**
- Create: `app/(calendar)/settings/users/page.tsx`
- Create: `components/users/user-management-panel.tsx`
- Modify: `app/(calendar)/layout.tsx`
- Modify: `docs/deployment.md`, `docs/auth-setup.md`, `docs/oauth-setup.md`
- Test: `tests/unit/user-management-panel.test.tsx`
- Test: `tests/e2e/user-management.spec.ts`

**Interfaces:**
- Consumes owner-only `/api/users` endpoints.
- Produces owner-only `/settings/users` page.

- [ ] **Step 1: Write failing UI tests**

```tsx
test('owner sees add and restore controls', () => {
  render(<UserManagementPanel initialUsers={fixtureUsers} currentUserId="owner-id" />);
  expect(screen.getByLabelText('E-posta')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Ekle' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Erişimi aç' })).toBeVisible();
});

test('owner row has no revoke control', () => {
  render(<UserManagementPanel initialUsers={fixtureUsers} currentUserId="owner-id" />);
  expect(screen.queryByRole('button', { name: 'Erişimi kapat' })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm test tests/unit/user-management-panel.test.tsx`

Expected: FAIL because panel does not exist.

- [ ] **Step 3: Implement owner page and panel**

Server page invokes `requireActiveOwner` before safe list projection. Client panel uses owner endpoints only, provides Turkish success/error status, refreshes list after mutations, and exposes neither Auth IDs nor secrets. Navigation appears only after server owner confirmation.

- [ ] **Step 4: Verify UI and authenticated E2E**

Run: `pnpm test tests/unit/user-management-panel.test.tsx`

Expected: PASS.

Add Playwright scenario using existing `PLAYWRIGHT_STORAGE_STATE`; skip only absent state and never bypass middleware.

- [ ] **Step 5: Document and commit**

Document `OWNER_EMAIL`, `provision:owner`, disabled hosted signups, Vercel secrets, owner page, and revoke behavior.

Run: `git add 'app/(calendar)/settings/users/page.tsx' components/users/user-management-panel.tsx 'app/(calendar)/layout.tsx' docs/deployment.md docs/auth-setup.md docs/oauth-setup.md tests/unit/user-management-panel.test.tsx tests/e2e/user-management.spec.ts`

Run: `git commit -m "feat: add owner user management settings"`

### Task 5: Tam doğrulama ve production bootstrap

**Files:**
- Modify only if a quality gate identifies a defect in Tasks 1-4.

- [ ] **Step 1: Run quality gates**

Run: `pnpm test`

Run: `pnpm exec tsc --noEmit --incremental false`

Run: `pnpm lint`

Run: `pnpm build`

Run: `pnpm test:e2e`

Expected: tüm çalışabilir testler geçer; yalnızca environment-gated testler skip olabilir.

- [ ] **Step 2: Verify Supabase and Vercel**

Use Supabase table/security/performance advisors to confirm RLS and no client grants. Confirm Vercel Production has `OWNER_EMAIL`, `SUPABASE_SERVICE_ROLE_KEY`, OAuth, public, encryption and cron key names without reading their values.

- [ ] **Step 3: Bootstrap and deploy**

Pull production environment only to ignored `.env.local`, run `pnpm provision:owner`, run `pnpm preflight:deployment`, then deploy using `pnpm dlx vercel --prod --yes --scope shenmalis-projects`. Verify unauthenticated redirect, owner Magic Link, user calendar isolation, member creation, revoke, restore, and no runtime errors.

- [ ] **Step 4: Final commit and push**

Run: `git status --short`

Run: `git add <only-files-created-or-modified-by-this-feature>`

Run: `git commit -m "feat: support owner-managed calendar members"`

Run: `git push origin codex/personal-calendar`
