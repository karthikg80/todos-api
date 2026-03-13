# Refresh Token Fallback Removal

The app auth flow now treats hashed refresh tokens as the only supported format.
Older plaintext `refresh_tokens.token` rows are no longer rotated in-place during
`refreshAccessToken`.

## Pre-deploy check

Run this against the target database:

```sql
SELECT COUNT(*) AS legacy_refresh_tokens
FROM refresh_tokens
WHERE token !~ '^[a-f0-9]{64}$';
```

If the count is `0`, no cleanup is required.

## Cleanup action

If the count is greater than `0`, remove the legacy rows before or immediately
after deploying this change:

```sql
DELETE FROM refresh_tokens
WHERE token !~ '^[a-f0-9]{64}$';
```

Effect:
- affected users will need to sign in again to obtain a new hashed refresh token
- current access tokens continue to work until they expire
- hashed refresh-token rotation and revoke behavior remain unchanged
