import jwt, { JwtHeader } from "jsonwebtoken";
import { randomBytes, createHash } from "crypto";
import { config } from "../config";
import { SocialUserProfile } from "./socialAuthService";

interface AppleJWK {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

interface AppleJWKS {
  keys: AppleJWK[];
}

interface AppleIdTokenPayload {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
  nonce?: string;
  nonce_supported?: boolean;
  email?: string;
  email_verified?: string | boolean;
  is_private_email?: string | boolean;
}

let cachedAppleKeys: { keys: AppleJWKS; fetchedAt: number } | null = null;
const APPLE_KEYS_CACHE_MS = 60 * 60 * 1000; // 1 hour

async function fetchApplePublicKeys(): Promise<AppleJWKS> {
  if (
    cachedAppleKeys &&
    Date.now() - cachedAppleKeys.fetchedAt < APPLE_KEYS_CACHE_MS
  ) {
    return cachedAppleKeys.keys;
  }

  const response = await fetch("https://appleid.apple.com/auth/keys");
  if (!response.ok) {
    throw new Error(`Failed to fetch Apple public keys: ${response.status}`);
  }

  const keys = (await response.json()) as AppleJWKS;
  cachedAppleKeys = { keys, fetchedAt: Date.now() };
  return keys;
}

function jwkToPem(jwk: AppleJWK): string {
  // Convert JWK RSA public key to PEM using Node.js crypto
  const keyObject = require("crypto").createPublicKey({
    key: {
      kty: jwk.kty,
      n: jwk.n,
      e: jwk.e,
    },
    format: "jwk",
  });
  return keyObject.export({ type: "spki", format: "pem" }) as string;
}

export class AppleAuthService {
  /**
   * Generate Apple Sign-In URL with state and nonce.
   * Returns { url, state, nonce } so the caller can persist both for validation.
   */
  generateAuthUrl(): { url: string; state: string; nonce: string } {
    const state = randomBytes(32).toString("hex");
    const nonce = randomBytes(32).toString("hex");

    const params = new URLSearchParams({
      client_id: config.appleClientId,
      redirect_uri: `${config.baseUrl}/auth/apple/callback`,
      response_type: "code id_token",
      response_mode: "form_post",
      scope: "name email",
      state,
      nonce: createHash("sha256").update(nonce).digest("hex"),
    });

    const url = `https://appleid.apple.com/auth/authorize?${params.toString()}`;
    return { url, state, nonce };
  }

  /**
   * Generate the client_secret JWT that Apple requires for token exchange.
   */
  private generateClientSecret(): string {
    const now = Math.floor(Date.now() / 1000);

    return jwt.sign(
      {
        iss: config.appleTeamId,
        iat: now,
        exp: now + 300, // 5 minutes
        aud: "https://appleid.apple.com",
        sub: config.appleClientId,
      },
      config.applePrivateKey,
      {
        algorithm: "ES256",
        keyid: config.appleKeyId,
      },
    );
  }

  /**
   * Verify Apple ID token against Apple JWKS.
   * Checks: signature, issuer, audience, expiry, nonce.
   */
  async verifyIdToken(
    idToken: string,
    expectedNonce?: string,
  ): Promise<SocialUserProfile> {
    const keys = await fetchApplePublicKeys();

    // Decode header to find the matching key
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || typeof decoded === "string") {
      throw new Error("Invalid Apple ID token");
    }

    const header = decoded.header as JwtHeader;
    const matchingKey = keys.keys.find((k) => k.kid === header.kid);
    if (!matchingKey) {
      throw new Error("Apple ID token signed with unknown key");
    }

    const pem = jwkToPem(matchingKey);

    const payload = jwt.verify(idToken, pem, {
      algorithms: ["RS256"],
      issuer: "https://appleid.apple.com",
      audience: config.appleClientId,
    }) as AppleIdTokenPayload;

    // Validate nonce if provided
    if (expectedNonce) {
      const expectedNonceHash = createHash("sha256")
        .update(expectedNonce)
        .digest("hex");
      if (payload.nonce !== expectedNonceHash) {
        throw new Error("Apple ID token nonce mismatch");
      }
    }

    const emailVerified =
      payload.email_verified === true || payload.email_verified === "true";

    return {
      provider: "apple",
      providerSubject: payload.sub,
      email: payload.email || null,
      emailVerified,
      name: null, // Apple only sends name on first auth; handled by caller
    };
  }

  /**
   * Exchange authorization code for tokens with Apple.
   */
  async exchangeCode(code: string): Promise<{ idToken: string }> {
    const clientSecret = this.generateClientSecret();

    const params = new URLSearchParams({
      client_id: config.appleClientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${config.baseUrl}/auth/apple/callback`,
    });

    const response = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!response.ok) {
      throw new Error(`Apple token exchange failed: ${response.status}`);
    }

    const data = (await response.json()) as { id_token: string };
    if (!data.id_token) {
      throw new Error("Apple did not return an ID token");
    }

    return { idToken: data.id_token };
  }
}
