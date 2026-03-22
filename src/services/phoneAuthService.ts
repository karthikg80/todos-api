import { PrismaClient } from "@prisma/client";
import { config } from "../config";
import { TwilioVerifyService } from "./twilioService";

export class PhoneAuthService {
  private twilioService: TwilioVerifyService;

  constructor(private prisma: PrismaClient) {
    this.twilioService = new TwilioVerifyService();
  }

  /**
   * Normalize a phone number to E.164 format.
   * Basic validation — rejects obviously invalid numbers.
   */
  static normalizePhone(phone: string): string {
    // Strip all non-digit characters except leading +
    const cleaned = phone.replace(/(?!^\+)[^\d]/g, "");

    if (!cleaned.startsWith("+")) {
      throw new Error("Phone number must include country code (e.g. +1...)");
    }

    // E.164: + followed by 7-15 digits
    const digits = cleaned.slice(1);
    if (digits.length < 7 || digits.length > 15) {
      throw new Error("Invalid phone number format");
    }

    // Block premium-rate prefixes (UK: +449, +4470; international: +1900)
    if (
      /^\+449\d/.test(cleaned) ||
      /^\+4470\d/.test(cleaned) ||
      /^\+1900\d/.test(cleaned)
    ) {
      throw new Error("Premium-rate numbers are not supported");
    }

    return cleaned;
  }

  /**
   * Send OTP via Twilio Verify.
   */
  async sendVerification(phoneE164: string): Promise<{ message: string }> {
    const normalized = PhoneAuthService.normalizePhone(phoneE164);
    await this.twilioService.sendVerification(normalized);
    return { message: "Verification code sent" };
  }

  /**
   * Check OTP via Twilio Verify, then find or create user.
   */
  async checkVerification(
    phoneE164: string,
    code: string,
    issueTokens: (
      userId: string,
      email: string | null,
    ) => Promise<{
      token: string;
      refreshToken: string;
    }>,
  ): Promise<{
    user: { id: string; email: string | null; name: string | null };
    token: string;
    refreshToken: string;
    isNewUser: boolean;
  }> {
    const normalized = PhoneAuthService.normalizePhone(phoneE164);

    const result = await this.twilioService.checkVerification(normalized, code);
    if (result.status !== "approved") {
      throw new Error("Invalid or expired code");
    }

    // Find or create user by phone
    let user = await this.prisma.user.findUnique({
      where: { phoneE164: normalized },
      select: { id: true, email: true, name: true },
    });

    let isNewUser = false;
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: null,
          password: null,
          phoneE164: normalized,
        },
        select: { id: true, email: true, name: true },
      });
      isNewUser = true;

      console.info(
        JSON.stringify({
          type: "phone_auth",
          event: "phone_create",
          userId: user.id,
          ts: new Date().toISOString(),
        }),
      );
    } else {
      console.info(
        JSON.stringify({
          type: "phone_auth",
          event: "phone_login",
          userId: user.id,
          ts: new Date().toISOString(),
        }),
      );
    }

    const tokens = await issueTokens(user.id, user.email);
    return { user, ...tokens, isNewUser };
  }
}
