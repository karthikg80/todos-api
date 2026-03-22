import {
  SocialAuthService,
  SocialUserProfile,
} from "./services/socialAuthService";
import { prisma } from "./prismaClient";

describe("SocialAuthService", () => {
  let service: SocialAuthService;
  const mockIssueTokens = jest.fn().mockResolvedValue({
    token: "test-token",
    refreshToken: "test-refresh",
  });

  beforeAll(() => {
    service = new SocialAuthService(prisma);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await prisma.socialAccount.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  describe("findOrCreateSocialUser", () => {
    it("should create a new user when no match exists", async () => {
      const profile: SocialUserProfile = {
        provider: "google",
        providerSubject: "google-123",
        email: "new@example.com",
        emailVerified: true,
        name: "New User",
      };

      const result = await service.findOrCreateSocialUser(
        profile,
        mockIssueTokens,
      );

      expect(result.isNewUser).toBe(true);
      expect(result.user.name).toBe("New User");
      expect(result.token).toBe("test-token");
      expect(result.refreshToken).toBe("test-refresh");

      // Verify SocialAccount was created
      const sa = await prisma.socialAccount.findFirst({
        where: { providerSubject: "google-123" },
      });
      expect(sa).not.toBeNull();
      expect(sa!.provider).toBe("google");
      expect(sa!.userId).toBe(result.user.id);
    });

    it("should sign in existing user when SocialAccount exists", async () => {
      // First, create a user with a social account
      const user = await prisma.user.create({
        data: {
          email: "existing@example.com",
          password: null,
          name: "Existing",
          socialAccounts: {
            create: {
              provider: "google",
              providerSubject: "google-456",
              emailAtProvider: "existing@example.com",
              emailVerifiedAtProvider: true,
            },
          },
        },
      });

      const profile: SocialUserProfile = {
        provider: "google",
        providerSubject: "google-456",
        email: "existing@example.com",
        emailVerified: true,
        name: "Existing",
      };

      const result = await service.findOrCreateSocialUser(
        profile,
        mockIssueTokens,
      );

      expect(result.isNewUser).toBe(false);
      expect(result.user.id).toBe(user.id);
    });

    it("should auto-link when verified email matches existing user", async () => {
      const user = await prisma.user.create({
        data: {
          email: "link@example.com",
          password: "hashed",
          name: "Link User",
        },
      });

      const profile: SocialUserProfile = {
        provider: "google",
        providerSubject: "google-789",
        email: "link@example.com",
        emailVerified: true,
        name: "Link User",
      };

      const result = await service.findOrCreateSocialUser(
        profile,
        mockIssueTokens,
      );

      expect(result.isNewUser).toBe(false);
      expect(result.user.id).toBe(user.id);

      // Verify SocialAccount was linked
      const sa = await prisma.socialAccount.findFirst({
        where: { userId: user.id, provider: "google" },
      });
      expect(sa).not.toBeNull();
    });

    it("should NOT auto-link with unverified email", async () => {
      await prisma.user.create({
        data: {
          email: "nolink@example.com",
          password: "hashed",
          name: "No Link",
        },
      });

      const profile: SocialUserProfile = {
        provider: "google",
        providerSubject: "google-unverified",
        email: "nolink@example.com",
        emailVerified: false,
        name: "No Link",
      };

      const result = await service.findOrCreateSocialUser(
        profile,
        mockIssueTokens,
      );

      // Should create a new user, not link to existing
      expect(result.isNewUser).toBe(true);
      expect(result.user.email).toBeNull();
    });

    it("should NOT auto-link with Apple relay email", async () => {
      await prisma.user.create({
        data: {
          email: "relay@privaterelay.appleid.com",
          password: "hashed",
        },
      });

      const profile: SocialUserProfile = {
        provider: "apple",
        providerSubject: "apple-relay",
        email: "relay@privaterelay.appleid.com",
        emailVerified: true,
        name: null,
      };

      const result = await service.findOrCreateSocialUser(
        profile,
        mockIssueTokens,
      );

      expect(result.isNewUser).toBe(true);
      expect(result.user.email).toBeNull();
    });
  });

  describe("getLinkedProviders", () => {
    it("should return linked providers for a user", async () => {
      const user = await prisma.user.create({
        data: {
          email: "multi@example.com",
          password: null,
          socialAccounts: {
            create: [
              {
                provider: "google",
                providerSubject: "g-1",
                emailAtProvider: "multi@example.com",
                emailVerifiedAtProvider: true,
              },
              {
                provider: "apple",
                providerSubject: "a-1",
                emailAtProvider: null,
                emailVerifiedAtProvider: false,
              },
            ],
          },
        },
      });

      const providers = await service.getLinkedProviders(user.id);
      expect(providers).toHaveLength(2);
      expect(providers.map((p) => p.provider).sort()).toEqual([
        "apple",
        "google",
      ]);
    });
  });

  describe("countLoginMethods", () => {
    it("should count password + social accounts + phone", async () => {
      const user = await prisma.user.create({
        data: {
          email: "count@example.com",
          password: "hashed",
          phoneE164: "+15551234567",
          socialAccounts: {
            create: {
              provider: "google",
              providerSubject: "g-count",
              emailAtProvider: "count@example.com",
              emailVerifiedAtProvider: true,
            },
          },
        },
      });

      const count = await service.countLoginMethods(user.id);
      // password=1 + phone=1 + 1 social = 3
      expect(count).toBe(3);
    });

    it("should count correctly for social-only user", async () => {
      const user = await prisma.user.create({
        data: {
          email: null,
          password: null,
          socialAccounts: {
            create: {
              provider: "google",
              providerSubject: "g-only",
              emailAtProvider: "only@example.com",
              emailVerifiedAtProvider: true,
            },
          },
        },
      });

      const count = await service.countLoginMethods(user.id);
      expect(count).toBe(1);
    });
  });

  describe("unlinkProvider", () => {
    it("should unlink a provider when user has multiple methods", async () => {
      const user = await prisma.user.create({
        data: {
          email: "unlink@example.com",
          password: "hashed",
          socialAccounts: {
            create: {
              provider: "google",
              providerSubject: "g-unlink",
              emailAtProvider: "unlink@example.com",
              emailVerifiedAtProvider: true,
            },
          },
        },
      });

      await service.unlinkProvider(user.id, "google", "g-unlink");

      const remaining = await prisma.socialAccount.count({
        where: { userId: user.id },
      });
      expect(remaining).toBe(0);
    });

    it("should reject unlinking the last sign-in method", async () => {
      const user = await prisma.user.create({
        data: {
          email: null,
          password: null,
          socialAccounts: {
            create: {
              provider: "google",
              providerSubject: "g-last",
              emailAtProvider: "last@example.com",
              emailVerifiedAtProvider: true,
            },
          },
        },
      });

      await expect(
        service.unlinkProvider(user.id, "google", "g-last"),
      ).rejects.toThrow("Cannot remove your only sign-in method");
    });
  });

  describe("getEnabledProviders", () => {
    it("should return provider flags from config", () => {
      const providers = service.getEnabledProviders();
      expect(providers).toHaveProperty("google");
      expect(providers).toHaveProperty("apple");
      expect(providers).toHaveProperty("phone");
    });
  });
});
