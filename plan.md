# Plan: Add Google, Apple, and Phone Number Login

## Overview

Add social login (Google, Apple) and phone number (SMS OTP) authentication to the existing email+password auth system. Users can link multiple auth methods to a single account via email matching.

---

## Phase 1: Database Schema Changes

### File: `prisma/schema.prisma`

1. **Add `authProvider` field to User model** — track how the account was created:
   ```prisma
   authProvider  String   @default("email") @db.VarChar(20)  // "email" | "google" | "apple" | "phone"
   ```

2. **Make `password` optional** — social/phone users won't have a password:
   ```prisma
   password  String?  @db.VarChar(255)
   ```

3. **Add `phone` field to User model**:
   ```prisma
   phone         String?  @unique @db.VarChar(20)
   ```

4. **Add `SocialAccount` model** — for linking multiple providers to one user:
   ```prisma
   model SocialAccount {
     id             String   @id @default(uuid())
     userId         String   @map("user_id")
     provider       String   @db.VarChar(20)   // "google" | "apple"
     providerUserId String   @db.VarChar(255)  // external user ID
     email          String?  @db.VarChar(255)
     name           String?  @db.VarChar(100)
     createdAt      DateTime @default(now())

     user User @relation(fields: [userId], references: [id], onDelete: Cascade)

     @@unique([provider, providerUserId])
     @@index([userId])
   }
   ```

5. **Add `PhoneVerification` model** — for SMS OTP codes:
   ```prisma
   model PhoneVerification {
     id        String   @id @default(uuid())
     phone     String   @db.VarChar(20)
     code      String   @db.VarChar(10)   // hashed OTP
     expiresAt DateTime
     attempts  Int      @default(0)
     createdAt DateTime @default(now())

     @@index([phone])
   }
   ```

6. **Create migration**: `npx prisma migrate dev --name add-social-phone-auth`

---

## Phase 2: Backend Configuration

### File: `src/config.ts`

Add new environment variables:

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

// Phone/SMS (Twilio)
TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',

// Feature flags
SOCIAL_LOGIN_ENABLED: process.env.SOCIAL_LOGIN_ENABLED || 'false',
PHONE_LOGIN_ENABLED: process.env.PHONE_LOGIN_ENABLED || 'false',
```

---

## Phase 3: Backend Services

### File: `src/services/socialAuthService.ts` (new)

**Google OAuth:**
1. `getGoogleAuthUrl()` — Generate OAuth consent URL with scopes (email, profile)
2. `handleGoogleCallback(code)` — Exchange auth code for tokens, fetch user profile from Google
3. `findOrCreateGoogleUser(googleProfile)` — Match by email or create new user, create SocialAccount link

**Apple Sign-In:**
1. `getAppleAuthUrl()` — Generate Apple Sign-In URL
2. `handleAppleCallback(code, idToken)` — Verify Apple ID token (JWT), extract user info
3. `findOrCreateAppleUser(appleProfile)` — Match by email or create new user, create SocialAccount link

**Shared logic:**
- `findOrCreateSocialUser(provider, providerUserId, email, name)`:
  - If user with matching email exists → link SocialAccount to that user
  - If no user exists → create new user (password=null, isVerified=true, authProvider=provider)
  - Generate JWT access token + refresh token (same as existing login)
  - Return `{ user, token, refreshToken }`

### File: `src/services/phoneAuthService.ts` (new)

1. `sendOtp(phone)`:
   - Generate 6-digit OTP
   - Hash it and store in PhoneVerification with 5-min expiry
   - Send SMS via Twilio
   - Rate limit: max 3 OTPs per phone per 10 minutes

2. `verifyOtp(phone, code)`:
   - Lookup latest PhoneVerification for phone
   - Increment attempts (max 5)
   - Timing-safe compare of hashed code
   - If valid: find/create user by phone, generate tokens
   - Delete used verification record

3. `findOrCreatePhoneUser(phone)`:
   - If user with matching phone exists → login
   - If no user exists → create new user (password=null, authProvider="phone")
   - Return `{ user, token, refreshToken }`

### File: `src/services/smsService.ts` (new)

- Thin wrapper around Twilio SDK
- `sendSms(to, body)` — send SMS message
- Abstracted for easy provider swap or testing

---

## Phase 4: Backend Routes

### File: `src/routes/authRouter.ts` (modify)

Add new endpoints:

```
# Google OAuth
GET  /auth/google              → Redirect to Google consent screen
GET  /auth/google/callback     → Handle OAuth callback, return tokens
POST /auth/google/token        → Exchange Google ID token (for frontend SDK flow)

# Apple Sign-In
GET  /auth/apple               → Redirect to Apple Sign-In
POST /auth/apple/callback      → Handle Apple callback (Apple uses POST)
POST /auth/apple/token         → Exchange Apple ID token (for frontend SDK flow)

# Phone/SMS
POST /auth/phone/send-otp      → Send OTP to phone number
POST /auth/phone/verify-otp    → Verify OTP and login/register

# Feature discovery
GET  /auth/providers            → Return enabled auth providers
```

### File: `src/validation/authValidation.ts` (modify)

Add validation schemas:
- `phoneSchema` — E.164 format validation (e.g., +1234567890)
- `otpSchema` — 6-digit numeric string
- `googleTokenSchema` — non-empty string
- `appleTokenSchema` — non-empty string

---

## Phase 5: NPM Dependencies

```bash
npm install google-auth-library    # Google OAuth & ID token verification
npm install jsonwebtoken           # Already exists (for Apple JWT verification)
npm install twilio                 # SMS/OTP delivery
```

Note: `apple-signin-auth` or manual JWT verification for Apple (Apple provides a JWKS endpoint). Could use `jose` library (lightweight) instead of a full Apple SDK.

---

## Phase 6: Frontend Changes

### File: `client/index.html` (modify)

Add social login buttons to **both login and register forms**, plus phone form:

```html
<!-- After login form submit button, before forgot password link -->
<div class="auth-divider"><span>or</span></div>
<div class="social-login-buttons" id="socialLoginButtons" style="display: none">
  <button type="button" class="btn social-btn google-btn"
          data-onclick="handleGoogleLogin()">
    <svg>...</svg> Continue with Google
  </button>
  <button type="button" class="btn social-btn apple-btn"
          data-onclick="handleAppleLogin()">
    <svg>...</svg> Continue with Apple
  </button>
  <button type="button" class="btn social-btn phone-btn"
          data-onclick="showPhoneLogin()">
    📱 Continue with Phone
  </button>
</div>

<!-- Phone Login Form (new, hidden by default) -->
<form id="phoneLoginForm" class="auth-form" style="display: none">
  <h2>Phone Login</h2>
  <div class="form-group">
    <label for="phoneNumber">Phone Number</label>
    <input type="tel" id="phoneNumber" required placeholder="+1 (555) 123-4567" />
  </div>
  <button type="button" class="btn" data-onclick="handleSendOtp()">Send Code</button>

  <div id="otpSection" style="display: none">
    <div class="form-group">
      <label for="otpCode">Verification Code</label>
      <input type="text" id="otpCode" required placeholder="123456"
             maxlength="6" pattern="[0-9]{6}" inputmode="numeric" />
    </div>
    <button type="button" class="btn" data-onclick="handleVerifyOtp()">Verify & Login</button>
  </div>

  <button type="button" class="link-btn" data-onclick="showLogin()">Back to Login</button>
</form>
```

### File: `client/modules/authUi.js` (modify)

Add handler functions:

1. `initSocialLogin()` — fetch `/auth/providers`, show/hide buttons based on enabled providers
2. `handleGoogleLogin()` — redirect to `/auth/google` or use Google Sign-In JS SDK
3. `handleAppleLogin()` — redirect to `/auth/apple` or use Apple JS SDK
4. `handleSocialCallback(provider, params)` — process redirect callback, store tokens
5. `showPhoneLogin()` — show phone form, hide others
6. `handleSendOtp()` — validate phone, POST to `/auth/phone/send-otp`, show OTP input
7. `handleVerifyOtp()` — POST to `/auth/phone/verify-otp`, store tokens on success

### File: `client/styles.css` (modify)

Add styles for:
- `.auth-divider` — "or" separator line
- `.social-btn` — base social button style
- `.google-btn` — Google brand colors (white bg, dark text)
- `.apple-btn` — Apple brand colors (black bg, white text)
- `.phone-btn` — neutral style
- `#otpSection` — OTP input area
- Dark theme variants for all new elements

### File: `client/app.js` (modify)

- Register new `data-onclick` handlers: `handleGoogleLogin`, `handleAppleLogin`, `showPhoneLogin`, `handleSendOtp`, `handleVerifyOtp`
- Call `initSocialLogin()` during app initialization (after auth view renders)
- Handle OAuth redirect params on page load (check URL for `?provider=google&code=...`)

---

## Phase 7: Auth Flow Details

### Google Login Flow
1. User clicks "Continue with Google"
2. Frontend redirects to `/auth/google` → backend redirects to Google consent screen
3. User authorizes → Google redirects to `/auth/google/callback?code=...`
4. Backend exchanges code for tokens, fetches profile, finds/creates user
5. Backend redirects to frontend with tokens in URL fragment: `/#auth=success&token=...&refreshToken=...`
6. Frontend reads fragment, stores tokens, shows app

**Alternative (client-side SDK flow):**
1. Load Google Sign-In SDK in `index.html`
2. User clicks button → Google popup → returns ID token
3. Frontend POST to `/auth/google/token` with ID token
4. Backend verifies token with Google, finds/creates user, returns app tokens

### Apple Login Flow
1. User clicks "Continue with Apple"
2. Redirect to Apple Sign-In → user authorizes
3. Apple POSTs to `/auth/apple/callback` with `id_token` + `code`
4. Backend verifies Apple JWT against Apple JWKS, extracts email/sub
5. Find/create user, redirect to frontend with tokens

### Phone Login Flow
1. User enters phone number, clicks "Send Code"
2. Frontend POST to `/auth/phone/send-otp` → backend sends SMS
3. User enters 6-digit code, clicks "Verify"
4. Frontend POST to `/auth/phone/verify-otp` → backend verifies, returns tokens
5. Frontend stores tokens, shows app

---

## Phase 8: Account Linking & Edge Cases

- **Email collision**: If a Google/Apple user's email matches an existing email+password account, link the social account to the existing user (don't create a duplicate)
- **No email from Apple**: Apple lets users hide their email — use Apple's relay email or prompt user to provide one
- **Phone + email**: Phone-only users have no email initially. They can add one later via profile settings
- **Password for social users**: Social-only users have `password=null`. If they try email login, show "Please use Google/Apple to sign in" message
- **Multiple providers**: A user can link Google AND Apple AND phone AND email. The `SocialAccount` table tracks all linked providers

---

## Phase 9: Tests

### Unit Tests: `src/socialAuthService.test.ts` (new)
- Google token verification (mock Google API)
- Apple JWT verification (mock JWKS)
- findOrCreateSocialUser — new user creation
- findOrCreateSocialUser — existing user linking
- Error handling for invalid tokens

### Unit Tests: `src/phoneAuthService.test.ts` (new)
- OTP generation and hashing
- OTP verification (correct, wrong, expired, max attempts)
- Phone user creation and lookup
- Rate limiting enforcement

### Integration Tests: `src/social-auth.api.test.ts` (new)
- POST `/auth/google/token` with valid/invalid token
- POST `/auth/phone/send-otp` validation
- POST `/auth/phone/verify-otp` flow
- GET `/auth/providers` response format

### UI Tests: `tests/ui/social-auth.spec.ts` (new)
- Social login buttons visible when providers enabled
- Phone login form toggle
- OTP input flow (mock API responses)

---

## Phase 10: Security Considerations

- **CSRF protection** for OAuth callbacks — use `state` parameter
- **OTP brute force** — max 5 attempts per code, rate limit send requests
- **Phone number validation** — E.164 format, block premium-rate numbers
- **Token verification** — Always verify Google/Apple tokens server-side, never trust client
- **Apple private relay email** — handle `privaterelay.appleid.com` addresses
- **Twilio webhook verification** — if using status callbacks

---

## Implementation Order

1. Schema changes + migration (Phase 1)
2. Config + env vars (Phase 2)
3. SMS service + phone auth (Phase 3, 4 — simplest to implement first)
4. Google OAuth (Phase 3, 4)
5. Apple Sign-In (Phase 3, 4)
6. Frontend UI (Phase 6)
7. Tests (Phase 9)
8. Run all verification checks from CLAUDE.md

---

## Files Changed (Summary)

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Modify — add fields + models |
| `prisma/migrations/...` | New — migration file |
| `src/config.ts` | Modify — add env vars |
| `src/services/socialAuthService.ts` | New |
| `src/services/phoneAuthService.ts` | New |
| `src/services/smsService.ts` | New |
| `src/routes/authRouter.ts` | Modify — add routes |
| `src/validation/authValidation.ts` | Modify — add schemas |
| `client/index.html` | Modify — add buttons + forms |
| `client/modules/authUi.js` | Modify — add handlers |
| `client/styles.css` | Modify — add styles |
| `client/app.js` | Modify — register handlers |
| `src/socialAuthService.test.ts` | New |
| `src/phoneAuthService.test.ts` | New |
| `src/social-auth.api.test.ts` | New |
| `tests/ui/social-auth.spec.ts` | New |
| `package.json` | Modify — add dependencies |
