# Deployment and operations guide

This runbook describes what must be configured before a deployment. It does not create a Vercel, Supabase, Google, or Microsoft application, and it contains no credentials.

## Environment inventory and preflight

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-visible | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-visible | Supabase publishable key used by browser and middleware. |
| `NEXT_PUBLIC_APP_URL` | Browser-visible | Canonical HTTPS origin used to construct OAuth callbacks. |
| `OWNER_EMAIL` | Server-only configuration | Initial owner account used only by `pnpm provision:owner`. Do not expose it in logs. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only secret | Privileged server-only database/Auth work. |
| `TOKEN_ENCRYPTION_KEY` | Server-only secret | Canonical base64 encoding of exactly 32 random bytes for AES-256-GCM token encryption. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Server-only configuration/secret | Google OAuth client credentials. The ID is not intrinsically secret, but this app reads both server-side. |
| `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Server-only configuration/secret | Microsoft OAuth client credentials. The ID is not intrinsically secret, but this app reads both server-side. |
| `CRON_SECRET` | Server-only secret | Bearer secret accepted only by the scheduled sync route. |

Generate a fresh encryption key and a separate cron secret in a secure terminal, then store each output directly in the secret manager:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

`CRON_SECRET` must be at least 16 characters and contain at least three of uppercase letters, lowercase letters, digits, and symbols. The base64url generator produces an appropriately high-entropy secret; rerun it rather than inventing a memorable phrase.

After loading the intended environment, run:

```bash
pnpm preflight:deployment
pnpm lint && pnpm test && pnpm build && pnpm test:e2e
```

The preflight checks all runtime names and the canonical 32-byte base64 key shape without printing values. Its non-zero result for an unset local environment is intentional. It is a pre-deploy/CI gate, not a build fallback; do not replace required secrets with empty defaults or weaken the production build.

For CI, load the target environment into the command process (for example with Vercel's environment tooling) and run the preflight before the build. Never commit the downloaded environment file.

## Supabase release sequence

1. Create a separate staging Supabase project or otherwise isolated data set. Do not grant staging or preview deployments production service-role access.
2. Run the staging sequence first. Link explicitly to the exact staging project ref, inspect the migration list, dry-run, and then apply only to staging:

   ```bash
   supabase link --project-ref <staging-project-ref>
   supabase migration list
   supabase db push --dry-run
   supabase db push
   ```

3. Verify staging login, source filtering, export, manual sync, project health, and Database Linter/Security Advisor results. Verify RLS with two active accounts: each identity may read only its own calendar, source, connection, and sync data. `oauth_connections` remains service-role-only.
4. Only after staging succeeds, back up production and record its exact Supabase project ref and current Vercel version. Re-link explicitly to production, inspect and dry-run before asking for approval:

   ```bash
   supabase link --project-ref <production-project-ref>
   supabase migration list
   supabase db push --dry-run
   ```

5. Confirm the linked production ref, migration list, and dry-run target with the approver. Only after that explicit approval, run `supabase db push`. Never use a direct push against an implicitly selected project.

Hosted Auth setup is separate from migrations: set the production Site URL to the canonical production URL, and allow the exact `https://<host>/auth/callback` magic-link redirect URL. Disable **Allow new users to sign up** before provisioning the initial owner. In a secure, service-role-only environment run `pnpm provision:owner`; it creates or reuses that Auth account and upserts its active `owner` membership without changing other users.

For previews, configure the preview site's exact `/auth/callback` URL in Supabase Auth as well. Do not assume an arbitrary Vercel preview hostname is allowed; use a stable preview domain or explicitly maintain the permitted URLs.

## Vercel configuration, cron, and rollback

Set all listed values in Vercel rather than in source control. Production gets production Supabase, domain, OAuth credentials, and unique secrets. Preview gets isolated preview values; it must not inherit production service-role, encryption, or cron secrets. Public variables are visible to browser code and must never contain a secret.

`vercel.json` schedules `GET /api/cron/sync` at `15 3 * * *`, which is 03:15 UTC every day. The route requires `Authorization: Bearer <CRON_SECRET>` and rejects missing or wrong values. Vercel Cron runs on production deployments, not previews. Do not call the route from a browser or place `CRON_SECRET` in a `NEXT_PUBLIC_` variable. On Vercel Hobby, the daily invocation may occur at any instant from 03:00:00 through 03:59:59 UTC for this schedule; do not use this plan when exact 03:15 execution is required. Higher plans run within the specified minute.

Configure the custom production domain before setting `NEXT_PUBLIC_APP_URL`; it must be an absolute HTTPS origin. A preview needs its own exact HTTPS origin and matching provider callback registration if OAuth is exercised there.

`TOKEN_ENCRYPTION_KEY` decrypts every stored OAuth token. Replacing it directly makes existing connections unreadable. Rotate only with a rehearsed migration that decrypts each token with the old key and re-encrypts it with the new key, keeping the old key only in the protected rotation process until verification succeeds. Back up encrypted data and document the key-version/rollback procedure first.

For application rollback, promote or roll back to the last known-good Vercel deployment and restore the compatible, correctly scoped environment. Database migrations are not automatically reversible: use a reviewed forward repair or explicit rollback migration after a backup. If a key rotation has completed, do not roll code back to a version that expects the old key without restoring a compatible key/data state.

## Post-deploy smoke test

1. Run the preflight against production configuration and inspect deployment logs without exposing secret values.
2. Confirm an unauthenticated visit redirects to `/login`. A magic-link request never creates a new Auth user; after sign-in, only an active `allowed_users` membership can enter the app. Sign in as the provisioned owner, add a test member from **Kullanıcılar**, and verify that each account can see only its own calendar data.
3. Connect one Google and one Microsoft test calendar, inspect provider audit logs for read-only activity, then run manual sync. Confirm tokens never appear in UI, responses, or logs.
4. Confirm the annual grid, source filter, and all ICS/CSV/XLSX downloads with known test events.
5. Verify one production cron execution in Vercel logs is authorized and completes. Do not manufacture a browser request carrying `CRON_SECRET`.

For the real authenticated Playwright smoke test, create a disposable active-member session and controlled calendar data that includes the named source and event. Then run:

```bash
PLAYWRIGHT_BASE_URL=https://preview.example.test PLAYWRIGHT_STORAGE_STATE=./tmp/member.json PLAYWRIGHT_FULL_FLOW_SOURCE_NAME="Smoke calendar" PLAYWRIGHT_FULL_FLOW_EVENT_TITLE="Deployment smoke event" pnpm test:e2e tests/e2e/full-flow.spec.ts
```

The storage state is sensitive; keep it outside the repository and remove it after the test. Without all fixture variables, `full-flow.spec.ts` skips rather than bypassing middleware, logging in programmatically, or inventing data.
