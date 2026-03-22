import { PrismaClient } from "@prisma/client";
import { config } from "../config";

export interface SocialUserProfile {
  provider: "google" | "apple";
  providerSubject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export interface SocialAuthResult {
  user: {
    id: string;
    email: string | null;
    name: string | null;
  };
  token: string;
  refreshToken: string;
  isNewUser: boolean;
}

function isAppleRelayEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@privaterelay.appleid.com");
}

export class SocialAuthService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Core linking logic per D1 decision tree:
   * 1. SocialAccount with (provider, providerSubject) exists → sign in that user
   * 2. emailVerified && not Apple relay && matching User email → auto-link
   * 3. All other cases → create new user
   */
  async findOrCreateSocialUser(
    profile: SocialUserProfile,
    issueTokens: (
      userId: string,
      email: string | null,
    ) => Promise<{
      token: string;
      refreshToken: string;
    }>,
  ): Promise<SocialAuthResult> {
    // Step 1: Check if SocialAccount already exists
    const existingLink = await this.prisma.socialAccount.findUnique({
      where: {
        provider_providerSubject: {
          provider: profile.provider,
          providerSubject: profile.providerSubject,
        },
      },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (existingLink) {
      const tokens = await issueTokens(
        existingLink.user.id,
        existingLink.user.email,
      );
      this.logLinkEvent(
        "social_login",
        existingLink.user.id,
        profile.provider,
        profile.providerSubject,
      );
      return {
        user: existingLink.user,
        ...tokens,
        isNewUser: false,
      };
    }

    // Step 2: Try auto-link if email is verified and not a relay
    const canAutoLink =
      profile.email &&
      profile.emailVerified &&
      !isAppleRelayEmail(profile.email);

    if (canAutoLink && profile.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: profile.email.toLowerCase() },
        select: { id: true, email: true, name: true },
      });

      if (existingUser) {
        await this.prisma.socialAccount.create({
          data: {
            userId: existingUser.id,
            provider: profile.provider,
            providerSubject: profile.providerSubject,
            emailAtProvider: profile.email,
            emailVerifiedAtProvider: profile.emailVerified,
          },
        });

        this.logLinkEvent(
          "social_link",
          existingUser.id,
          profile.provider,
          profile.providerSubject,
        );

        const tokens = await issueTokens(existingUser.id, existingUser.email);
        return {
          user: existingUser,
          ...tokens,
          isNewUser: false,
        };
      }
    }

    // Step 3: Create new user
    const newUser = await this.prisma.user.create({
      data: {
        email:
          canAutoLink && profile.email ? profile.email.toLowerCase() : null,
        password: null,
        name: profile.name,
        isVerified: profile.emailVerified && !!profile.email,
        socialAccounts: {
          create: {
            provider: profile.provider,
            providerSubject: profile.providerSubject,
            emailAtProvider: profile.email,
            emailVerifiedAtProvider: profile.emailVerified,
          },
        },
      },
      select: { id: true, email: true, name: true },
    });

    this.logLinkEvent(
      "social_create",
      newUser.id,
      profile.provider,
      profile.providerSubject,
    );

    const tokens = await issueTokens(newUser.id, newUser.email);
    return {
      user: newUser,
      ...tokens,
      isNewUser: true,
    };
  }

  async getLinkedProviders(userId: string): Promise<
    Array<{
      provider: string;
      providerSubject: string;
      emailAtProvider: string | null;
      createdAt: Date;
    }>
  > {
    return this.prisma.socialAccount.findMany({
      where: { userId },
      select: {
        provider: true,
        providerSubject: true,
        emailAtProvider: true,
        createdAt: true,
      },
    });
  }

  async countLoginMethods(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, phoneE164: true },
    });
    const socialCount = await this.prisma.socialAccount.count({
      where: { userId },
    });
    let count = socialCount;
    if (user?.password) count += 1;
    if (user?.phoneE164) count += 1;
    return count;
  }

  async unlinkProvider(
    userId: string,
    provider: string,
    providerSubject: string,
  ): Promise<void> {
    const methodCount = await this.countLoginMethods(userId);
    if (methodCount <= 1) {
      throw new Error("Cannot remove your only sign-in method");
    }

    await this.prisma.socialAccount.deleteMany({
      where: { userId, provider, providerSubject },
    });

    this.logLinkEvent("social_unlink", userId, provider, providerSubject);
  }

  getEnabledProviders(): { google: boolean; apple: boolean; phone: boolean } {
    return {
      google: config.googleLoginEnabled,
      apple: config.appleLoginEnabled,
      phone: config.phoneLoginEnabled,
    };
  }

  private logLinkEvent(
    event: string,
    userId: string,
    provider: string,
    providerSubject: string,
  ): void {
    console.info(
      JSON.stringify({
        type: "social_auth",
        event,
        userId,
        provider,
        providerSubject,
        ts: new Date().toISOString(),
      }),
    );
  }
}
