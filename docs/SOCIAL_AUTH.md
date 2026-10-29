# BINHI Google and Apple sign-in — engineering and owner runbook

## Status: review code, not enabled providers or a production release

Development implementation on `feat/binhi-social-auth`, based on the preserved
workspace `7f89a6f`. The original workspace and Essential 250 worktree were not
edited. No production migration, console modification, secret change, merge,
deployment or root workflow restart was performed.

Google and Apple are **off by default**. Available means configuration passed
local checks, **not** that a real provider redirect has been verified. All
provider journeys in this evidence are synthetic. Owner credentials, real
console registration and real-device/provider tests are separate gates.

The existing seven-phase **working mapping** in `CREATIVE_STUDIO.md` is used;
its labels have not been independently confirmed as the organisational standard.

| Phase | Evidence / gate |
|---|---|
| 1. Discover | Existing Fastify password/scrypt auth, Postgres sessions, header CSRF, account ownership, deletion, hosting and three worktrees inspected. No active task was found at intake; queued Studio tasks remain untouched. |
| 2. Define | Add Google/Apple identity methods without changing BINHI user IDs or substituting Clerk/Auth0. Do not touch icon artwork, ORIGIN, production or unrelated queued features. |
| 3. Architect | Bounded OIDC client, identity service and auth routes. BINHI users remain authoritative; future ORIGIN integration must use an explicit contract, not provider email as identity. |
| 4. Design | Existing password forms retained; accessible disabled provider states, account-method controls, fresh reauthentication and explicit disconnect/delete confirmations. Phone/tablet layouts checked. |
| 5. Build | Additive migrations, strict Google/Apple token handling, issuer+subject mapping, scoped cookies, owner-bound grants, encrypted Apple revocation tokens. |
| 6. Verify | Typecheck, 164 unit/integration cases, build, migration compatibility check and synthetic auth/website/Studio browser journeys. See evidence below. |
| 7. Release / learn | **HOLD.** Draft review only; real-provider validation, owner eligibility/setup, security review, database approval and separate founder release approval remain. |

## Architecture and security contract

- Existing password hashes, cookie name, user IDs, project ownership and
  SessionService issuance are retained. OAuth login uses that same session
  service, not provider access tokens as BINHI sessions.
- `binhi_auth_identities` is unique by **issuer + subject**, and by user +
  issuer. Provider email is display/contact information, never an automatic
  linking key. An email collision requires signing into the original account
  and explicitly linking. Apple relay addresses are accepted only when verified.
- Existing users default to `password_enabled=true`. OAuth-only accounts have
  `false` and an unusable hash marker, not a shared password. Password login
  still performs the existing dummy password work when unavailable.
- Linking requires an authenticated session and a fresh, single-use grant.
  Password checks or an already-linked provider can issue a grant; provider
  reauthentication must return the **same linked identity**. Grants last five
  minutes and are bound to both user and initiating session.
- Unlinking locks the user row and checks remaining **configured, usable**
  methods. Concurrent unlink attempts cannot remove the last method. Provider
  methods with disabled configuration are not counted as usable fallbacks.
- Ten-minute OAuth transactions store HMAC state/binding hashes, a nonce hash,
  and an encrypted Google verifier. Callback consumption is atomic and single
  use, including cancellation and invalid responses.
- Google authorization-code flow uses S256 PKCE. Apple uses its documented
  `form_post` flow, state/nonce and server client authentication; unsupported
  Apple PKCE fields are not invented.
- ID tokens use fixed HTTPS JWKS endpoints and a narrow RS256-only profile:
  signature, kid, RSA key size, issuer, string audience, optional azp, expiry,
  issued-at, optional not-before, stable subject and nonce are checked.
  Untrusted jku/x5u/crit/b64 headers and unsupported algorithms are rejected.
  Responses are bounded, fetches time out, redirects are rejected, and keys
  refresh on unknown kid with a ten-second anti-DoS interval/five-minute cache.
- Apple's ES256 client secret is signed with the configured P-256 key for
  **five minutes**, not stored as a long-lived generated JWT. JWKS rotation
  and client-secret signing have deterministic tests.
- Only the registered Apple callback POST is exempt from the custom request
  header. Other API writes keep `x-binhi-request: editor`. The Apple callback
  requires a narrow-path HttpOnly **Secure; SameSite=None** browser-binding
  cookie plus a valid one-use transaction; the main Lax cookie is unchanged.
  The initiating session is checked server-side even when absent on the POST.
- Callbacks suppress request logging, reject duplicate form fields, bound body
  size and use fixed local redirects/messages. No raw provider error, tokens,
  authorization code or arbitrary return URL is reflected. Auth APIs use no-store.
- Apple refresh tokens are retained only as AES-GCM ciphertext for consent
  revocation; Google access/refresh tokens are discarded. Encryption is
  domain-separated from the existing session secret. Private signing keys
  remain environment references, never database fields or client data.
- Apple disconnect and account deletion revoke consent through Apple's fixed
  `/auth/revoke` endpoint before removing the local identity. A provider failure
  leaves the account/identity intact and returns a retryable 503; the fresh
  grant is consumed. **Apple configuration must remain available for this
  operation.** This dependency is deliberate, not a silent partial deletion.
- OAuth-only account deletion needs fresh reauthentication and the existing
  explicit account-delete confirmation; password accounts retain password
  confirmation. Existing content deletion and session revocation are reused.
- Security audit events contain action, actor and optional provider only.
  Never log credentials, codes, tokens, PKCE verifiers or complete callback URLs.
  Rate limiting is the existing process-local model, not a distributed WAF.

## Development database and migration gate

Only the agent-created disposable cluster on `127.0.0.1:55434` was modified:
`binhi_auth_dev` for development migration and `binhi_auth_test` for destructive
tests. Neither is the workspace's attached database or production database.
`db:check` reported **19 binhi tables** (18 application tables plus migration
metadata). There was no production connection/query.

- `0002_nervous_carlie_cooper.sql`: three auth tables and default-true password flag.
- `0003_awesome_the_enforcers.sql`: nullable encrypted revocation-token column.
- Drizzle schema, journal and both snapshots are committed coherently.
- Earlier migrations remain unchanged. New unique/FK checks are confined to
  new identity tables and annotated for review; `db:compat` exits successfully
  but still reports those review-required constraints.

**The reviewed build requires these migrations even if both providers remain
disabled.** Do not serve it against the unchanged production database. Owner
approval, a backup/recovery check and the normal schema release review precede
any production migration. An old password-only build can read the expanded
schema, but OAuth-only accounts cannot sign into that old build. Do not drop
identity tables or pretend a code rollback restores OAuth-only access.

Rotating `BINHI_SESSION_SECRET` invalidates existing sessions and also affects
encrypted OAuth material. An Apple sign-in/reauthentication refreshes its
revocation token with the current encryption key. Plan secret recovery and
rotation; do not change this secret merely to rotate Apple's signing key.

## Exact owner setup: Google

Do not alter a pre-existing OAuth project/client used by another product.

1. In Google Cloud / Google Auth Platform, select an owner-approved project
   (or create a separate one). Configure branding, support/contact information,
   audience and consent screen; add privacy-policy/terms links and authorized
   domains as required. Add development test users if the consent app is testing.
2. Create an OAuth client of type **Web application**. Use a distinct
   development client and production client. This backend flow does not need
   Google API scopes or a Workspace connector; scopes are openid/email/profile.
3. Register the **exact** HTTPS callback on the development host serving the
   reviewed branch: `/api/auth/google/callback`. In the current Replit workspace,
   the candidate URL is `https://$REPLIT_DEV_DOMAIN/api/auth/google/callback`;
   expand the host before registration. The untouched root build does not yet
   implement these new routes. Use an approved dedicated development runtime.
4. Register production separately, only when authorized:
   **`https://binhi.replit.app/api/auth/google/callback` — GET.**
5. Provide the development client ID and client secret through Replit Secrets,
   **not chat or a file upload**. Confirm exact redirect matching in a real flow.

## Exact owner setup: Apple — eligibility is a prerequisite

Apple's current official environment guide explicitly says: **“For users to
authenticate with your web service, you must have an existing app in the App
Store that uses Sign in with Apple.”** Its web setup also requires association
with an existing primary iOS/macOS/tvOS/watchOS App ID enabled for Sign in with
Apple. A web-only Services ID is not assumed sufficient.

Owner must first confirm eligible app association and appropriate Apple
Developer Program/team access. No evidence of the owner's eligibility was
available. **Apple cannot be declared enabled.**

1. Enable Sign in with Apple on the eligible primary App ID in Certificates,
   Identifiers & Profiles; preserve unrelated app/project configuration.
2. Create a **Services ID** for BINHI web authentication. Enable Sign in with
   Apple and associate the eligible primary App ID. The Services ID, not the
   native bundle ID, is the web client ID.
3. Register the development HTTPS domain/subdomain and full return URL
   `/api/auth/apple/callback`; use a separate development Services ID/key where
   practical. The current candidate host is `$REPLIT_DEV_DOMAIN`, expanded to
   its literal domain. Apple does not accept localhost/IP return URLs.
4. For a separately authorized production setup, register domain
   **`binhi.replit.app`** and return URL
   **`https://binhi.replit.app/api/auth/apple/callback` — POST/form_post.**
   Apple's account-help page says no server verification-file upload is required.
5. Create a Sign in with Apple private key associated with the primary app.
   Record Team ID and Key ID; download the `.p8` key securely (owner-controlled
   storage). Provide its PEM content only through Replit Secrets. Never upload
   it into the repo, documentation, chat, logs or PR.
6. If sending to private relay addresses, register outbound domains/sources
   and configure SPF/DKIM. Existing email-delivery integrations are not an
   automatic Apple relay registration.
7. Review provider branding/policy and real Apple-device/browser journeys.
   Server-to-server Apple account-change notifications are **not implemented**
   in this slice; assess this lifecycle integration before production approval.

### Credential references and opt-in configuration

These are **names only**, not values. Owner supplies them through Secrets;
this task did not set them. Configuration flags are a separate owner action.

| Development secret | Production counterpart (separate approval) |
|---|---|
| BINHI_GOOGLE_DEVELOPMENT_CLIENT_ID | BINHI_GOOGLE_PRODUCTION_CLIENT_ID |
| BINHI_GOOGLE_DEVELOPMENT_CLIENT_SECRET | BINHI_GOOGLE_PRODUCTION_CLIENT_SECRET |
| BINHI_APPLE_DEVELOPMENT_CLIENT_ID | BINHI_APPLE_PRODUCTION_CLIENT_ID |
| BINHI_APPLE_DEVELOPMENT_TEAM_ID | BINHI_APPLE_PRODUCTION_TEAM_ID |
| BINHI_APPLE_DEVELOPMENT_KEY_ID | BINHI_APPLE_PRODUCTION_KEY_ID |
| BINHI_APPLE_DEVELOPMENT_PRIVATE_KEY | BINHI_APPLE_PRODUCTION_PRIVATE_KEY |

Owner opts in only after setup: `BINHI_GOOGLE_ENABLED=true` and/or
`BINHI_APPLE_ENABLED=true`; matching `BINHI_OAUTH_ENVIRONMENT=development`
or `production` is required. Apple additionally requires owner confirmation
`BINHI_APPLE_ELIGIBILITY_CONFIRMED=true`. Production never falls back to
development credential names. `BINHI_PUBLIC_URL` must be the exact approved
origin. Invalid enabled config fails startup without echoing credential values.

To rotate the Apple signing key: create the replacement within Apple's
two-key allowance, supply the replacement environment-specific key ID/PEM
via Secrets, deploy/restart only through a separately approved operation,
verify a real redirect and revocation, then revoke the old key. Do not revoke
the working key before the replacement is verified.

## Verification evidence and remaining release gates

- `npm run typecheck` — passed.
- `npm test` — **18 files, 164 tests passed** on the dedicated test database.
- `npm run build` — passed; existing bundle-size and Fastify deprecation warnings remain.
- `npm run db:compat` — success, annotated constraint review remains mandatory.
- `npm run test:e2e:auth` — **7 synthetic HTTPS browser checks passed**:
  disabled states, Google signup/session, Apple cross-site binding without main
  cookie, provider reauth/unlink, OAuth-only deletion, password regression,
  mobile/tablet layout and fixed error text. No console page errors.
- `npm run test:e2e` — **15 checks passed**, including keyboard signup/edit/
  publish, conflict recovery, autosave, undo/history, anonymous responsive
  multi-page publication, unpublish and own-account cleanup.
- `npm run test:e2e:studio` — **19 checks passed**, including real image output,
  private projects/library, design/template/brand kits and account isolation.
- Added auth job to CI after existing browser jobs. Final CI status is reported
  separately with the draft PR; local success is not a claim of remote CI success.
- Visual inspection: isolated unavailable sign-in at 390px and signed-in
  browser screenshots at 390/820px. This is not a full WCAG certification or a
  real Safari/Firefox/Apple-device test.

New tests cover issuer/audience/expiry/nonce/key/algorithm attacks, JWKS refresh,
state/binding/callback replay, duplicate Apple fields, identity confusion,
verified relay email, closed signup, session-bound grants, last-method races,
disabled fallback providers, encrypted revocation and provider-failure recovery.

Release blockers: real console credentials/eligibility and redirect tests;
independent security review of the bounded native-crypto verifier; provider
branding and Apple lifecycle review; existing dependency risks (initial npm ci
reported 9 findings: 3 high, 6 moderate; no dependencies were changed); migration/
backup approval; and **separate founder permission to release**. No sign-off,
merge, production data change or deployment is implied by this document.

### Official sources verified 2026-10-26

- https://developers.google.com/identity/openid-connect/openid-connect
- https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple
- https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web
- https://developer.apple.com/help/account/capabilities/create-a-sign-in-with-apple-private-key
- https://developer.apple.com/documentation/signinwithapplerestapi/revoke-tokens
