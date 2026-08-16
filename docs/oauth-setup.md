# Google and Microsoft OAuth setup

These are registration instructions only. No client application has been created, verified, or approved by this repository.

## Common rules

The application constructs callback URLs from `NEXT_PUBLIC_APP_URL`, which must be an absolute HTTPS origin outside `localhost`. Register the exact production callback URL for each provider:

| Provider | Production redirect URI | Exact scopes requested by the code |
| --- | --- | --- |
| Google | `https://<production-host>/api/connections/google/callback` | `https://www.googleapis.com/auth/calendar.readonly` |
| Microsoft | `https://<production-host>/api/connections/microsoft/callback` | `offline_access`, `https://graph.microsoft.com/Calendars.Read` |

Both integrations use authorization-code flow with PKCE. Google requests offline access so it can obtain a refresh token; Microsoft explicitly requests `offline_access`, which the v2 authorization-code flow requires for refresh tokens. This application obtains the provider account from Microsoft Graph rather than an ID token, so it does not request the unnecessary OIDC identity scopes `openid`, `profile`, or `email`. Do not add write scopes, such as Google calendar write access or Microsoft `Calendars.ReadWrite`.

OAuth providers match redirect URIs exactly. Vercel's changing preview URLs are not automatically valid. Either avoid OAuth connection testing on ephemeral previews or give the preview a stable HTTPS hostname, set its scoped `NEXT_PUBLIC_APP_URL`, and register these matching preview callbacks separately:

- `https://<preview-host>/api/connections/google/callback`
- `https://<preview-host>/api/connections/microsoft/callback`

Never reuse production client secrets or token encryption keys in a preview environment.

## Google Cloud

1. In Google Cloud, configure the OAuth consent screen before creating the credential. Select the audience/account type that matches the one allowed user; for an external app in testing, add that account as a test user. Publish or complete verification only when Google's scope/audience rules require it.
2. Create an OAuth 2.0 **Web application** client and add the exact production Google callback URI above under Authorized redirect URIs. Add the stable preview URI only when preview OAuth testing is deliberately enabled.
3. Put the generated values in server-only `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` for the matching Vercel scope. Do not put a client secret in browser code.
4. Review the consent screen to ensure the only calendar scope is `https://www.googleapis.com/auth/calendar.readonly`. The application should appear as read-only and no provider mutation calls should be authorized.

## Microsoft Entra ID

1. This code uses the Microsoft `common` v2 endpoints for both authorization and token exchange. Register the app as **Accounts in any organizational directory and personal Microsoft accounts** (multitenant plus personal accounts), which is compatible with `common`. Do not select a single-tenant registration while retaining `common`; use a tenant-specific endpoint only as an intentional code-and-configuration change.
2. Add the exact production Microsoft callback URI under Web redirect URIs. Add a separate stable preview callback only for controlled preview OAuth testing.
3. Add delegated permissions only: `offline_access` and Microsoft Graph `Calendars.Read`. Do not grant application permissions, OIDC profile scopes, or `Calendars.ReadWrite`. Obtain/admin-consent only if tenant policy requires it for this allowed account.
4. Create a client secret, record its expiry and rotation owner, and store the resulting values as server-only `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` in the correct environment scope.

## Verification after configuration

Sign in as the already provisioned `ALLOWED_EMAIL`, start each connection from the app, and check that the provider returns to the matching callback. Confirm that a manual sync only lists/reads calendars and events, and that neither refresh tokens nor client secrets occur in responses, UI, telemetry, or logs. Revoke the test connection if it is no longer needed.
