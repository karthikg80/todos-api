import { OAuth2Client } from "google-auth-library";
import { randomBytes } from "crypto";
import { config } from "../config";
import { SocialUserProfile } from "./socialAuthService";

export class GoogleAuthService {
  private client: OAuth2Client;

  constructor() {
    this.client = new OAuth2Client(
      config.googleClientId,
      config.googleClientSecret,
      config.googleRedirectUri,
    );
  }

  /**
   * Generate the Google OAuth consent URL with a cryptographic state param.
   * Returns { url, state } so the caller can persist state for CSRF validation.
   */
  generateAuthUrl(): { url: string; state: string } {
    const state = randomBytes(32).toString("hex");
    const url = this.client.generateAuthUrl({
      access_type: "offline",
      scope: ["openid", "email", "profile"],
      state,
      prompt: "select_account",
    });
    return { url, state };
  }

  /**
   * Exchange the authorization code for tokens, verify the ID token,
   * and return a normalized SocialUserProfile.
   */
  async handleCallback(code: string): Promise<SocialUserProfile> {
    const { tokens } = await this.client.getToken(code);

    if (!tokens.id_token) {
      throw new Error("Google did not return an ID token");
    }

    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token,
      audience: config.googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      throw new Error("Invalid Google ID token payload");
    }

    // Validate issuer
    if (
      payload.iss !== "accounts.google.com" &&
      payload.iss !== "https://accounts.google.com"
    ) {
      throw new Error("Invalid Google ID token issuer");
    }

    return {
      provider: "google",
      providerSubject: payload.sub,
      email: payload.email || null,
      emailVerified: payload.email_verified === true,
      name: payload.name || null,
    };
  }
}
