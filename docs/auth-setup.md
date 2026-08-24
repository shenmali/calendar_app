# Owner-managed e-posta kodu setup

`OWNER_EMAIL` is server-only bootstrap configuration. The login page never receives, renders, or serializes an allow list. Authorization is enforced after sign-in by the server-side auth callback and on every protected request through the server-only `allowed_users` table.

## Local Supabase

The tracked `supabase/config.toml` disables global and email sign-up. It also selects the local passwordless e-mail template at `supabase/templates/magic-link.html`; this template uses `{{ .Token }}` and must not include `{{ .ConfirmationURL }}`. Restart local Auth after changing that configuration:

```bash
supabase stop
supabase start
```

## Hosted Supabase project

In Supabase Dashboard, Authentication → Configuration, disable **Allow new users to sign up**. This hosted setting is not propagated by `config.toml` and is mandatory before release.

Then open **Authentication → Email Templates → Magic Link**. Set the subject to `Takvim giriş kodunuz` and set the body to an e-mail that contains `{{ .Token }}` (for example, `Takvime giriş kodunuz: {{ .Token }}`). Remove `{{ .ConfirmationURL }}` from this template. Supabase uses the same template for magic links and email OTPs: including `{{ .Token }}` makes `signInWithOtp` send an eight-digit code instead of a one-time URL. This is a required hosted-release step and must be completed only after the code-only login screen is deployed.

Provision the initial owner from a secure server-only environment:

```bash
pnpm provision:owner
```

The command requires `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `OWNER_EMAIL`. It neither prints the address nor exposes the service-role key. It creates or reuses the matching Auth account and upserts an active owner membership.

The browser requests an eight-digit e-mail code with `shouldCreateUser: false`; hosted signup disablement prevents a new Auth account from being created by that request. The code is verified server-side before the active membership check and profile upsert. The owner adds or restores members at **/settings/users**. The verification route and middleware admit only active memberships. Revoking a member immediately blocks application requests and bans future Auth sessions; restoring the member re-enables both while retaining their calendar data.
