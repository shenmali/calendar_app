# Personal Calendar

Single-user, read-only calendar aggregation for Google Calendar and Microsoft Outlook. The application displays a Turkish annual planner and exports the selected range as ICS, CSV, or XLSX. It never writes to a provider calendar.

## Local setup

1. Copy `.env.example` to `.env.local` and fill in only development credentials.
2. Install dependencies with `pnpm install`.
3. Run `pnpm preflight:deployment` after loading the target environment. The command reports only missing variable names and an invalid encryption-key format; it never prints values.
4. Run `pnpm dev`.

The required variable names are in `.env.example`. The code uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not the deprecated `NEXT_PUBLIC_SUPABASE_ANON_KEY` name).

## Operations

Read the [deployment guide](docs/deployment.md) before configuring a hosted service. Exact OAuth scopes and callbacks are in [OAuth setup](docs/oauth-setup.md); owner-managed e-mail code safeguards are in [auth setup](docs/auth-setup.md).

## Checks

```bash
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

The authenticated end-to-end flow skips unless `PLAYWRIGHT_STORAGE_STATE`, `PLAYWRIGHT_FULL_FLOW_SOURCE_NAME`, and `PLAYWRIGHT_FULL_FLOW_EVENT_TITLE` are supplied. It does not bypass middleware or create users.
