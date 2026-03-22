import { PhoneAuthService } from "./services/phoneAuthService";
import { prisma } from "./prismaClient";

// Mock the TwilioVerifyService
jest.mock("./services/twilioService", () => ({
  TwilioVerifyService: jest.fn().mockImplementation(() => ({
    sendVerification: jest.fn().mockResolvedValue({
      status: "pending",
      sid: "VE-mock-sid",
    }),
    checkVerification: jest.fn().mockResolvedValue({
      status: "approved",
      sid: "VE-mock-sid",
    }),
  })),
}));

describe("PhoneAuthService", () => {
  let service: PhoneAuthService;
  const mockIssueTokens = jest.fn().mockResolvedValue({
    token: "test-token",
    refreshToken: "test-refresh",
  });

  beforeAll(() => {
    service = new PhoneAuthService(prisma);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  describe("normalizePhone", () => {
    it("should accept valid E.164 numbers", () => {
      expect(PhoneAuthService.normalizePhone("+15551234567")).toBe(
        "+15551234567",
      );
    });

    it("should strip non-digit characters", () => {
      expect(PhoneAuthService.normalizePhone("+1 (555) 123-4567")).toBe(
        "+15551234567",
      );
    });

    it("should reject numbers without country code", () => {
      expect(() => PhoneAuthService.normalizePhone("5551234567")).toThrow(
        "Phone number must include country code",
      );
    });

    it("should reject too-short numbers", () => {
      expect(() => PhoneAuthService.normalizePhone("+1234")).toThrow(
        "Invalid phone number format",
      );
    });

    it("should reject too-long numbers", () => {
      expect(() =>
        PhoneAuthService.normalizePhone("+1234567890123456"),
      ).toThrow("Invalid phone number format");
    });

    it("should reject UK premium-rate +449 prefix", () => {
      expect(() => PhoneAuthService.normalizePhone("+4491234567")).toThrow(
        "Premium-rate numbers are not supported",
      );
    });

    it("should reject UK premium-rate +4470 prefix", () => {
      expect(() => PhoneAuthService.normalizePhone("+44701234567")).toThrow(
        "Premium-rate numbers are not supported",
      );
    });

    it("should reject US premium-rate +1900 prefix", () => {
      expect(() => PhoneAuthService.normalizePhone("+19001234567")).toThrow(
        "Premium-rate numbers are not supported",
      );
    });
  });

  describe("sendVerification", () => {
    it("should send OTP via Twilio", async () => {
      const result = await service.sendVerification("+15551234567");
      expect(result.message).toBe("Verification code sent");
    });
  });

  describe("checkVerification", () => {
    it("should create a new user for unknown phone", async () => {
      const result = await service.checkVerification(
        "+15559876543",
        "123456",
        mockIssueTokens,
      );

      expect(result.isNewUser).toBe(true);
      expect(result.user.email).toBeNull();
      expect(result.token).toBe("test-token");
      expect(result.refreshToken).toBe("test-refresh");

      // Verify user was created in DB
      const dbUser = await prisma.user.findUnique({
        where: { phoneE164: "+15559876543" },
      });
      expect(dbUser).not.toBeNull();
    });

    it("should sign in existing phone user", async () => {
      const existingUser = await prisma.user.create({
        data: {
          email: null,
          password: null,
          phoneE164: "+15551111111",
        },
      });

      const result = await service.checkVerification(
        "+15551111111",
        "123456",
        mockIssueTokens,
      );

      expect(result.isNewUser).toBe(false);
      expect(result.user.id).toBe(existingUser.id);
    });

    it("should reject invalid OTP", async () => {
      // Override mock for this test
      const { TwilioVerifyService } = jest.requireMock(
        "./services/twilioService",
      );
      TwilioVerifyService.mockImplementationOnce(() => ({
        sendVerification: jest.fn(),
        checkVerification: jest.fn().mockResolvedValue({
          status: "denied",
          sid: "VE-denied",
        }),
      }));

      const failService = new PhoneAuthService(prisma);

      await expect(
        failService.checkVerification(
          "+15552222222",
          "000000",
          mockIssueTokens,
        ),
      ).rejects.toThrow("Invalid or expired code");
    });
  });
});
