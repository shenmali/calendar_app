# Single-user magic-link setup

`ALLOWED_EMAIL` is server-only configuration. The login page must never receive, render, or serialize it to client code. Authorization is enforced after sign-in by the server-side auth callback and middleware; the browser form intentionally does not disclose which address is allowed.

## Local Supabase

The tracked `supabase/config.toml` disables global and email sign-up. Restart local Auth after changing that configuration:

```bash
supabase stop
supabase start
```

## Hosted Supabase project

In Supabase Dashboard, Authentication → Configuration, disable **Allow new users to sign up**. This hosted setting is not propagated by `config.toml` and is mandatory before release.

Provision only the allowed address from a secure server-only environment:

```bash
pnpm provision:allowed-user
```

The command requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ALLOWED_EMAIL`. It neither prints the address nor exposes the service-role key, and it refuses to proceed if a different Auth user already exists. Resolve any unexpected account manually in Supabase Dashboard as a separate, audited operation.

The browser requests a magic link with `shouldCreateUser: false`; hosted signup disablement prevents a new Auth account from being created by that request. Server-side callback and middleware checks then reject any session whose verified email does not match `ALLOWED_EMAIL`.
