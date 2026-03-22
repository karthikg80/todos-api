import { config } from "../config";

interface VerificationResult {
  status: "pending" | "approved" | "canceled" | "denied";
  sid: string;
}

/**
 * Thin wrapper around Twilio Verify API.
 * Abstracted for easy mocking in tests.
 */
export class TwilioVerifyService {
  private client: ReturnType<typeof import("twilio")> | null = null;

  private getClient() {
    if (!this.client) {
      // Lazy-load twilio to avoid import errors when not configured
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const twilio = require("twilio") as typeof import("twilio");
      this.client = twilio(config.twilioAccountSid, config.twilioAuthToken);
    }
    return this.client;
  }

  async sendVerification(
    phoneE164: string,
    channel: "sms" | "call" = "sms",
  ): Promise<VerificationResult> {
    const client = this.getClient();
    const verification = await client.verify.v2
      .services(config.twilioVerifyServiceSid)
      .verifications.create({
        to: phoneE164,
        channel,
      });

    return {
      status: verification.status as VerificationResult["status"],
      sid: verification.sid,
    };
  }

  async checkVerification(
    phoneE164: string,
    code: string,
  ): Promise<VerificationResult> {
    const client = this.getClient();
    const check = await client.verify.v2
      .services(config.twilioVerifyServiceSid)
      .verificationChecks.create({
        to: phoneE164,
        code,
      });

    return {
      status: check.status as VerificationResult["status"],
      sid: check.sid,
    };
  }
}
