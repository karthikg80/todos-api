# Plan: Add Google, Apple, and Phone Number Login

## Overview

Add social login (Google, Apple) and phone number (SMS OTP) authentication to the existing email+password auth system. Users can link multiple auth methods to a single account. The `SocialAccount` table is the source of truth for linked identities — no redundant `authProvider` on User.

---

## Phase 1: Database Schema Changes

### File: `prisma/schema.prisma`

1. **Make `password` optional** — social/phone users won't have a password:
   ```prisma
   password  String?  @db.VarChar(255)  // nullable; null for social/phone-only users
   ```

2. **Add `phoneE164` field to User model** — always stored in E.164 format:
   ```prisma
   phoneE164  String?  @unique @db.VarChar(20)
   ```

3. **Add `SocialAccount` model** — source of truth for linked provider identities:
   ```prisma
   model SocialAccount {
     id                     String   @id @default(uuid())
     userId                 String   @map("user_id")
     provider               String   @db.VarChar(20)   // "google" | "apple"
     providerSubject        String   @db.VarChar(255)  // provider's stable user ID (sub claim)
     emailAtProvider        String?  @db.VarChar(255)  // email as reported by provider
     emailVerifiedAtProvider Boolean @default(false)    // whether provider confirmed the email
     createdAt              DateTime @default(now())

     user User @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@unique([provider, providerSubject])
     @@index([userId])
   }
   ```

4. **Phone verification — use Twilio Verify** (preferred) or thin local model as fallback:

   If using Twilio Verify: no `PhoneVerification` model needed — Twilio manages OTP state.

   If self-managed fallback:
   ```prisma
   model PhoneVerification {
     id          String    @id @default(uuid())
     phoneE164   String    @db.VarChar(20)
     codeHash    String    @db.VarChar(255)   // bcrypt or HMAC hash of OTP
     expiresAt   DateTime
     attempts    Int       @default(0)        // max 5
     lastSentAt  DateTime  @default(now())    // for resend cooldown
     consumedAt  DateTime?                    // null until successfully verified
     createdAt   DateTime  @default(now())

     @@index([phoneE164])
   }
   ```

5. **Create migration**: `npx prisma migrate dev --name add-social-phone-auth`

### Data model notes
- `authProvider` is intentionally **not** on User. The SocialAccount table (one user → many linked identities) is the source of truth for how a user authenticates.
- All phone numbers normalized to E.164 before storage.
- `email` on User remains the canonical contact email; `emailAtProvider` on SocialAccount tracks what the provider reported (may differ for Apple relay addresses).

---

## Phase 2: Backend Configuration

### File: `src/config.ts`

Add new environment variables with **per-provider feature flags**:

```typescript
// Google OAuth
GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || `${BASE_URL}/auth/google/callback`,

// Apple Sign-In
APPLE_CLIENT_ID: process.env.APPLE_CLIENT_ID || '',        // Services ID
APPLE_TEAM_ID: process.env.APPLE_TEAM_ID || '',
APPLE_KEY_ID: process.env.APPLE_KEY_ID || '',
APPLE_PRIVATE_KEY: process.env.APPLE_PRIVATE_KEY || '',     // .p8 key contents

// Phone/SMS (Twilio Verify)
TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
TWILIO_VERIFY_SERVICE_SID: process.env.TWILIO_VERIFY_SERVICE_SID || '',

// Per-provider feature flags
GOOGLE_LOGIN_ENABLED: process.env.GOOGLE_LOGIN_ENABLED || 'false',
APPLE_LOGIN_ENABLED: process.env.APPLE_LOGIN_ENABLED || 'false',
PHONE_LOGIN_ENABLED: process.env.PHONE_LOGIN_ENABLED || 'false',
```

---

## Phase 3: Backend Services

### File: `src/services/socialAuthService.ts` (new)

**Google OAuth (backend-driven web flow only for v1):**
1. `getGoogleAuthUrl(state)` — Generate OAuth consent URL with scopes (email, profile), include cryptographic `state` param for CSRF
2. `handleGoogleCallback(code, state)` — Validate state, exchange auth code for tokens via Google API, verify ID token server-side using `google-auth-library`
3. `findOrCreateSocialUser(provider, providerSubject, email, emailVerified, name)` — see linking rules below

**Apple Sign-In (backend-driven web flow only for v1):**
1. `getAppleAuthUrl(state, nonce)` — Generate Apple Sign-In URL with state + nonce
2. `handleAppleCallback(code, idToken, state)` — Validate state, verify Apple ID token JWT against Apple JWKS (issuer: `https://appleid.apple.com`, audience: our client ID), extract sub/email claims
3. Uses same `findOrCreateSocialUser()` as Google

**Account linking rules (critical security policy):**
- `findOrCreateSocialUser(provider, providerSubject, email, emailVerified, name)`:
  1. Check if SocialAccount with `(provider, providerSubject)` already exists → if so, log in that user directly
  2. If `emailVerified === true` AND a User with matching email exists → auto-link: create SocialAccount for existing user
  3. If `emailVerified === false` or email is an Apple private relay → do NOT auto-link; create a new user account
  4. If no matching user exists → create new user (`password=null`, `isVerified=true` if provider email verified)
  5. Generate JWT access token + refresh token (same as existing login flow)
  6. **Log every linking event** (userId, provider, providerSubject, linkedAt) for auditability
  7. Return `{ user, token, refreshToken, isNewUser }`

### File: `src/services/phoneAuthService.ts` (new)

**Uses Twilio Verify API** (preferred over self-managed OTP):

1. `sendVerification(phoneE164)`:
   - Normalize to E.164
   - Call Twilio Verify `verifications.create({ to: phoneE164, channel: 'sms' })`
   - Twilio handles OTP generation, delivery, expiry, and rate limiting
   - Apply server-side rate limit: max 3 sends per phone per 10 minutes, per-IP throttle

2. `checkVerification(phoneE164, code)`:
   - Call Twilio Verify `verificationChecks.create({ to: phoneE164, code })`
   - Twilio handles attempt counting and expiry
   - If approved: find/create user by phone, generate tokens
   - Return generic error messages (anti-enumeration)

3. `findOrCreatePhoneUser(phoneE164)`:
   - If User with matching `phoneE164` exists → login
   - If no user exists → create new user (`password=null`, `email=null`)
   - Return `{ user, token, refreshToken, isNewUser }`

### File: `src/services/twilioService.ts` (new)

- Thin wrapper around Twilio Verify SDK
- `sendVerification(to, channel)` — start verification
- `checkVerification(to, code)` — check verification
- Abstracted for easy testing (mock in unit tests)

---

## Phase 4: Backend Routes

### File: `src/routes/authRouter.ts` (modify)

**v1 uses backend-driven redirect flow only** (no client-side SDK flow — reduces testing surface):

```
# Feature discovery
GET  /auth/providers              → { google: bool, apple: bool, phone: bool }

# Google OAuth (backend redirect flow)
GET  /auth/google/start           → Generate state, store in session/cookie, redirect to Google
GET  /auth/google/callback        → Validate state, exchange code, issue tokens, redirect to app

# Apple Sign-In (backend redirect flow)
GET  /auth/apple/start            → Generate state + nonce, store, redirect to Apple
POST /auth/apple/callback         → Apple POSTs here; validate state, verify JWT, issue tokens, redirect

# Phone/SMS
POST /auth/phone/send-otp         → Send verification SMS via Twilio Verify
POST /auth/phone/verify-otp       → Check code, issue tokens
```

**OAuth security requirements (explicit):**
- **`state` parameter**: cryptographically random, stored server-side (short-lived cookie or in-memory store), validated on callback — prevents CSRF
- **`nonce`** (Apple): included in auth request, validated in ID token claims
- **Strict redirect URI allowlist**: only configured callback URLs accepted
- **Token validation**: Google ID tokens verified via `google-auth-library` (checks signature, issuer `accounts.google.com`, audience = our client ID, expiry). Apple ID tokens verified against Apple JWKS (checks signature, issuer `https://appleid.apple.com`, audience, nonce, expiry)
- **Session creation**: JWT + refresh token issued only after provider token is fully validated server-side

### File: `src/validation/authValidation.ts` (modify)

Add validation schemas:
- `phoneE164Schema` — E.164 format validation (e.g., `+1234567890`), reject premium-rate prefixes
- `otpSchema` — 6-digit numeric string
- `oauthStateSchema` — non-empty string matching expected format

---

## Phase 5: NPM Dependencies

```bash
npm install google-auth-library    # Google OAuth & ID token verification
npm install twilio                 # Twilio Verify for SMS OTP
```

Apple JWT verification: use `jsonwebtoken` (already a dependency) + fetch Apple JWKS from `https://appleid.apple.com/auth/keys`. No additional Apple-specific package needed.

---

## Phase 6: Frontend Changes

### File: `client/index.html` (modify)

Add social login buttons to **both login and register forms**, plus phone form:

```html
<!-- After login/register form submit button -->
<div class="auth-divider"><span>or</span></div>
<div class="social-login-buttons" id="socialLoginButtons" style="display: none">
  <button type="button" class="btn social-btn google-btn"
          id="googleLoginBtn" style="display: none"
          data-onclick="handleGoogleLogin()">
    <svg><!-- Google "G" logo --></svg> Continue with Google
  </button>
  <button type="button" class="btn social-btn apple-btn"
          id="appleLoginBtn" style="display: none"
          data-onclick="handleAppleLogin()">
    <svg><!-- Apple logo --></svg> Sign in with Apple
  </button>
  <button type="button" class="btn social-btn phone-btn"
          id="phoneLoginBtn" style="display: none"
          data-onclick="showPhoneLogin()">
    Continue with Phone
  </button>
</div>

<!-- Phone Login Form (new, hidden by default) -->
<form id="phoneLoginForm" class="auth-form" style="display: none">
  <h2>Phone Login</h2>
  <div class="form-group">
    <label for="phoneNumber">Phone Number</label>
    <input type="tel" id="phoneNumber" required placeholder="+1 555 123 4567" />
  </div>
  <button type="button" class="btn" id="sendOtpBtn" data-onclick="handleSendOtp()">
    Send Code
  </button>

  <div id="otpSection" style="display: none">
    <p class="otp-hint">Code sent to <span id="otpPhoneMasked"></span></p>
    <div class="form-group">
      <label for="otpCode">Verification Code</label>
      <input type="text" id="otpCode" required placeholder="123456"
             maxlength="6" pattern="[0-9]{6}" inputmode="numeric"
             autocomplete="one-time-code" />
    </div>
    <button type="button" class="btn" data-onclick="handleVerifyOtp()">Verify & Login</button>
    <button type="button" class="link-btn" id="resendOtpBtn" disabled
            data-onclick="handleResendOtp()">
      Resend code (<span id="resendTimer">60</span>s)
    </button>
  </div>

  <button type="button" class="link-btn" data-onclick="showLogin()">Back to Login</button>
</form>
```

### File: `client/modules/authUi.js` (modify)

Add handler functions:

1. `initSocialLogin()` — fetch `GET /auth/providers`, show/hide individual buttons based on which providers are enabled
2. `handleGoogleLogin()` — `window.location.href = '/auth/google/start'` (backend redirect)
3. `handleAppleLogin()` — `window.location.href = '/auth/apple/start'` (backend redirect)
4. `handleSocialCallback()` — on page load, check URL for `?auth=success&token=...&refreshToken=...`, extract and store tokens, clear URL params
5. `showPhoneLogin()` — show phone form, hide login/register forms
6. `handleSendOtp()` — validate phone (basic E.164 check), POST to `/auth/phone/send-otp`, show OTP input, start resend countdown timer (60s)
7. `handleVerifyOtp()` — POST to `/auth/phone/verify-otp`, store tokens on success, show generic errors (anti-enumeration)
8. `handleResendOtp()` — re-send OTP, reset countdown timer
9. `maskPhone(phoneE164)` — display as `+1 *** *** 4567` in OTP section

### File: `client/styles.css` (modify)

Add styles for:
- `.auth-divider` — "or" separator line with horizontal rules
- `.social-btn` — base social button style (full-width, icon + text)
- `.google-btn` — white bg, dark text, Google brand compliance
- `.apple-btn` — black bg, white text, Apple HIG compliant (use Apple's required button style)
- `.phone-btn` — neutral/outline style
- `.otp-hint` — small text for masked phone display
- `#resendOtpBtn:disabled` — greyed out during countdown
- Dark theme variants for all new elements

### File: `client/app.js` (modify)

- Register new `data-onclick` handlers: `handleGoogleLogin`, `handleAppleLogin`, `showPhoneLogin`, `handleSendOtp`, `handleVerifyOtp`, `handleResendOtp`
- Call `initSocialLogin()` during app initialization
- Call `handleSocialCallback()` on page load to process OAuth redirect returns

---

## Phase 7: Auth Flow Details

### Google Login Flow (backend redirect only in v1)
1. User clicks "Continue with Google"
2. Frontend navigates to `/auth/google/start`
3. Backend generates cryptographic `state`, stores in short-lived httpOnly cookie, redirects to Google consent screen
4. User authorizes → Google redirects to `/auth/google/callback?code=...&state=...`
5. Backend validates `state` against cookie, exchanges code for tokens, verifies ID token server-side (signature, issuer, audience, expiry)
6. Backend calls `findOrCreateSocialUser()` with verified claims
7. Backend issues app JWT + refresh token, redirects to `/?auth=success&token=...&refreshToken=...`
8. Frontend `handleSocialCallback()` extracts tokens, stores them, shows app

### Apple Login Flow (backend redirect only in v1)
1. User clicks "Sign in with Apple"
2. Frontend navigates to `/auth/apple/start`
3. Backend generates `state` + `nonce`, stores both in httpOnly cookie, redirects to Apple
4. User authorizes → Apple POSTs to `/auth/apple/callback` with `id_token`, `code`, `state`
5. Backend validates `state`, verifies Apple ID token JWT against Apple JWKS (issuer, audience, nonce, expiry)
6. Note: Apple may only return user name/email on **first authorization** — must persist in SocialAccount on first link
7. Backend calls `findOrCreateSocialUser()`, issues tokens, redirects to app

### Phone Login Flow
1. User enters phone number, clicks "Send Code"
2. Frontend validates basic format, POST to `/auth/phone/send-otp`
3. Backend normalizes to E.164, calls Twilio Verify to send SMS
4. Frontend shows OTP input, masks phone number, starts 60s resend countdown
5. User enters 6-digit code, clicks "Verify"
6. Frontend POST to `/auth/phone/verify-otp` → backend calls Twilio Verify check
7. If approved: find/create user by phone, issue tokens, return to frontend
8. Frontend stores tokens, shows app

---

## Phase 8: Account Management & Edge Cases

### Account linking policy
- **Auto-link only when safe**: provider reports `email_verified: true` AND email matches an existing user → link SocialAccount
- **No auto-link when risky**: unverified email or Apple private relay → create separate account
- **Manual linking**: future feature — authenticated user can link additional providers from settings (requires re-auth to existing account first)
- **Log all linking events** for audit trail

### Edge cases
- **Apple private relay emails** (`privaterelay.appleid.com`): store as `emailAtProvider`, do NOT use for auto-linking. User can optionally add a real email later via profile settings
- **Apple first-auth-only data**: Apple may only send user name on the first authorization. Persist name in SocialAccount on initial link; don't expect it on subsequent logins
- **Phone-only users**: have `email=null`. Can add email later via profile settings
- **Password for social users**: `password=null`. If they attempt email+password login, return generic "Invalid credentials" (anti-enumeration — don't reveal which providers they used)
- **Unlinking last provider**: prevent removing the last login method (must always have at least one way to sign in). Enforce in backend

### Session lifecycle
- Social/phone login issues the same JWT + refresh token as email login — no special session handling needed
- Logout behavior identical: revoke refresh token, clear localStorage
- Refresh token rotation works the same regardless of auth method

### Recovery UX (future)
- Social user wants to add password → profile settings "Set Password" flow
- Phone user wants to add email → profile settings "Add Email" flow
- These are account management features, not v1 auth features

---

## Phase 9: Security Checklist

### OAuth security (explicit requirements)
- [ ] `state` parameter: crypto-random, stored in httpOnly cookie (not localStorage), validated on callback
- [ ] `nonce` (Apple): included in auth URL, validated in ID token `nonce` claim
- [ ] PKCE: not required for v1 backend flow (confidential client), but recommended for future mobile/SPA flows
- [ ] Redirect URI allowlist: only exact-match configured URIs accepted by Google/Apple
- [ ] ID token verification: signature, issuer, audience, expiry — all checked server-side
- [ ] Never trust client-supplied email/name — always use verified claims from provider tokens

### Phone/OTP security
- [ ] Twilio Verify handles OTP generation, delivery, attempt limits, and expiry
- [ ] Server-side rate limits: max 3 sends per phone per 10 min, per-IP throttle
- [ ] E.164 normalization before all operations
- [ ] Block known premium-rate/short-code prefixes
- [ ] Generic error messages — never confirm whether a phone number has an account (anti-enumeration)
- [ ] Resend cooldown enforced both client-side (60s timer) and server-side

### General
- [ ] All new endpoints behind rate limiter
- [ ] Audit log entries for: social login, social account link, phone login, failed attempts
- [ ] Tokens in redirect URLs use URL fragment (`#`) not query params where possible, or use short-lived intermediary codes

---

## Phase 10: Tests

### Unit Tests: `src/socialAuthService.test.ts` (new)
- Google ID token verification (mock `google-auth-library`)
- Apple JWT verification (mock JWKS fetch)
- `findOrCreateSocialUser` — new user creation
- `findOrCreateSocialUser` — auto-link with verified email
- `findOrCreateSocialUser` — no auto-link with unverified email
- `findOrCreateSocialUser` — no auto-link with Apple relay email
- `findOrCreateSocialUser` — existing SocialAccount direct login
- State parameter generation and validation
- Error handling for invalid/expired tokens

### Unit Tests: `src/phoneAuthService.test.ts` (new)
- E.164 normalization
- Twilio Verify send (mock Twilio SDK)
- Twilio Verify check — approved, denied, expired (mock)
- Phone user creation and lookup
- Rate limiting enforcement

### Integration Tests: `src/social-auth.api.test.ts` (new)
- GET `/auth/providers` — returns correct flags per config
- GET `/auth/google/start` — redirects with state cookie
- GET `/auth/google/callback` — rejects invalid state
- POST `/auth/phone/send-otp` — validation, rate limiting
- POST `/auth/phone/verify-otp` — success and failure flows
- Account linking: social login with matching verified email

### UI Tests: `tests/ui/social-auth.spec.ts` (new)
- Social login buttons visible/hidden per `/auth/providers` response
- Individual provider buttons respect per-provider flags
- Phone login form toggle and back navigation
- OTP input field appears after send
- Resend timer countdown
- Masked phone number display

---

## Implementation Order (risk-reducing)

1. **Schema + migrations** (Phase 1) — foundation for everything
2. **Config + env vars** (Phase 2) — per-provider feature flags
3. **Google OAuth end-to-end** (Phase 3, 4, 7) — most common provider, good proof of concept
4. **Apple Sign-In end-to-end** (Phase 3, 4, 7) — builds on Google patterns, adds nonce
5. **Phone auth end-to-end** (Phase 3, 4, 7) — independent of OAuth flows
6. **Account linking rules** (Phase 8) — enforce across all providers
7. **Frontend integration** (Phase 6) — connect UI to working backend
8. **Security hardening** (Phase 9) — audit checklist pass
9. **Tests** (Phase 10) — unit, integration, UI
10. **Run all verification checks** from CLAUDE.md

---

## Files Changed (Summary)

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Modify — add fields + models |
| `prisma/migrations/...` | New — migration file |
| `src/config.ts` | Modify — add env vars + per-provider flags |
| `src/services/socialAuthService.ts` | New — Google/Apple auth + linking logic |
| `src/services/phoneAuthService.ts` | New — Twilio Verify integration |
| `src/services/twilioService.ts` | New — Twilio Verify SDK wrapper |
| `src/routes/authRouter.ts` | Modify — add OAuth + phone routes |
| `src/validation/authValidation.ts` | Modify — add phone/OTP schemas |
| `client/index.html` | Modify — add social buttons + phone form |
| `client/modules/authUi.js` | Modify — add handlers + callback processing |
| `client/styles.css` | Modify — add social/phone styles + dark theme |
| `client/app.js` | Modify — register handlers + init social login |
| `src/socialAuthService.test.ts` | New — unit tests |
| `src/phoneAuthService.test.ts` | New — unit tests |
| `src/social-auth.api.test.ts` | New — integration tests |
| `tests/ui/social-auth.spec.ts` | New — UI tests |
| `package.json` | Modify — add `google-auth-library`, `twilio` |
