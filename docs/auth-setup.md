# Owner-managed magic-link setup

`OWNER_EMAIL` is server-only bootstrap configuration. The login page never receives, renders, or serializes an allow list. Authorization is enforced after sign-in by the server-side auth callback and on every protected request through the server-only `allowed_users` table.

## Local Supabase

The tracked `supabase/config.toml` disables global and email sign-up. Restart local Auth after changing that configuration:

```bash
supabase stop
supabase start
```

## Hosted Supabase project

In Supabase Dashboard, Authentication → Configuration, disable **Allow new users to sign up**. This hosted setting is not propagated by `config.toml` and is mandatory before release.

Provision the initial owner from a secure server-only environment:

```bash
pnpm provision:owner
```

The command requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OWNER_EMAIL`. It neither prints the address nor exposes the service-role key. It creates or reuses the matching Auth account and upserts an active owner membership.

The browser requests a magic link with `shouldCreateUser: false`; hosted signup disablement prevents a new Auth account from being created by that request. The owner adds or restores members at **/settings/users**. The callback and middleware admit only active memberships. Revoking a member immediately blocks application requests and bans future Auth sessions; restoring the member re-enables both while retaining their calendar data.
