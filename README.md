# auth-lab

Local sandbox for modern sign-up and sign-in, built with Next.js 16,
[Better Auth](https://better-auth.com) 1.7 and a local SQLite file (`auth.db`).

**Ways to sign in**
- **Google** (plus Google One Tap), **Apple** and **GitHub**: each turns on once its keys are in `.env.local`
- **Passkeys**: Face ID, Touch ID, Windows Hello or a security key. Add one in Settings, and it also shows up in the username field's autofill.
- **Email or username + password**, with email verification and password reset
- **Email code or magic link**: passwordless, and creates the account on first use
- A **"Last used"** badge marks the method you used last

**Security**
- **Two-factor authentication** (authenticator app + 10 single-use backup codes), asked
  after password sign-in. Accounts with 2FA can't sign in with an email code or
  magic link alone; they must use password + code, or a passkey.
- **Breached-password check** on sign-up, change and reset (Have I Been Pwned; only
  the first 5 characters of the password's SHA-1 hash leave your machine)
- **Rate limiting**: 5 password attempts per minute, 3 email-code attempts per minute, 3 reset emails per minute
- Google/Apple won't attach themselves to an unverified password account (prevents account pre-hijacking)
- Password reset signs out every other session

**Settings page** (`/settings`): profile and username, change or set a password,
manage passkeys, turn 2FA on/off and regenerate backup codes, connect or disconnect
providers, see and sign out other sessions, delete the account (confirmed by email).

**Emails are not sent.** Verification, reset, sign-in codes and links, and delete
confirmations are printed in the dev-server terminal and shown at
<http://localhost:3000/dev/outbox>.

## Quick start (Google only)

```bash
npm install
npm run db:migrate      # creates auth.db with user/session/account tables
npm run dev             # http://localhost:3000
```

`.env.local` already has a generated `BETTER_AUTH_SECRET`. A provider's button
only appears once its keys are in `.env.local`. Restart `npm run dev` after any change.

### Google keys (≈5 min, free)

1. Go to <https://console.cloud.google.com/auth/clients> and create or select a project.
2. Set up the **OAuth consent screen**: External, in Testing mode. Add your own
   Gmail under *Test users*.
3. **Create client**, choosing *Web application*:
   - Authorized JavaScript origins: `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
4. Copy the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## Apple (needs a paid account and an HTTPS tunnel)

Apple **does not accept `localhost` or `http://` return URLs**, and it requires
an [Apple Developer Program](https://developer.apple.com/programs/) membership
($99/yr). To test locally, expose port 3000 through an HTTPS tunnel. ngrok's free
plan gives you one **static** domain, so you only register it with Apple once:

```bash
brew install ngrok
ngrok config add-authtoken <token>          # from dashboard.ngrok.com
ngrok http 3000 --url=<your-name>.ngrok-free.app
```

Then in <https://developer.apple.com/account/resources>:

1. **Identifiers → App IDs**: create one with *Sign in with Apple* enabled.
2. **Identifiers → Services IDs**: create one (e.g. `dev.yourname.authlab.web`).
   Enable *Sign in with Apple* → Configure:
   - Domain: `<your-name>.ngrok-free.app`
   - Return URL: `https://<your-name>.ngrok-free.app/api/auth/callback/apple`
3. **Keys**: create a key with *Sign in with Apple* and download `AuthKey_XXXX.p8`.
   Put it in the project root. It's gitignored.
4. Fill in `.env.local`:
   ```
   APPLE_CLIENT_ID=dev.yourname.authlab.web     # the Services ID, not the App ID
   APPLE_TEAM_ID=XXXXXXXXXX
   APPLE_KEY_ID=XXXXXXXXXX
   APPLE_PRIVATE_KEY_PATH=./AuthKey_XXXXXXXXXX.p8
   BETTER_AUTH_URL=https://<your-name>.ngrok-free.app
   ```
5. Run `npm run apple:secret` and paste the printed `APPLE_CLIENT_SECRET=` line
   into `.env.local`. The secret expires after 180 days, so re-run it then.
6. Add the tunnel host to `allowedDevOrigins` in `next.config.ts`, restart
   `npm run dev`, and **browse via the ngrok URL** (not localhost) when testing Apple.
   If you use Google through the tunnel too, add the ngrok origin and callback to
   the Google client.

### GitHub keys (≈3 min, free)

<https://github.com/settings/developers> → **New OAuth App**. Homepage
`http://localhost:3000`, callback `http://localhost:3000/api/auth/callback/github`.
Put the client ID and a generated secret in `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

### Google One Tap

It uses the same Google client. In the client's **Authorized JavaScript origins**, add
**both** `http://localhost:3000` and `http://localhost` (Google requires the bare
one for One Tap on localhost). If you dismiss the prompt a few times, Google hides
it for a while. That's expected.

Apple only sends the user's name on the **first** sign-in. To test that again,
remove the app at appleid.apple.com → *Sign in with Apple*.

## Layout

| Path | What it does |
| --- | --- |
| `src/lib/auth.ts` | Better Auth server config: providers, DB, account linking, session length |
| `src/lib/auth-client.ts` | Browser client (`authClient.signIn.social`, `signOut`) |
| `src/app/api/auth/[...all]/route.ts` | Every auth endpoint, including OAuth callbacks |
| `src/app/page.tsx` | Sign-in / sign-up screen (redirects to dashboard if signed in) |
| `src/app/dashboard/page.tsx` | Protected page: session is checked on the server |
| `src/components/auth-card.tsx` | Sign-in / create-account forms (email-or-username, password strength, username check) |
| `src/app/forgot-password`, `src/app/reset-password` | Password reset flow |
| `src/lib/mailer.ts` + `src/app/dev/outbox` | Local fake mailer and the inbox page that shows its emails |
| `src/app/settings` | Settings page, its sections, and the set-password server action |
| `src/app/two-factor` | The code prompt after password sign-in |
| `scripts/apple-secret.mjs` | Builds Apple's JWT client secret from the `.p8` key |

To start over with no users, delete `auth.db` and run `npm run db:migrate`.
