import nodemailer from "nodemailer";
import { randomBytes } from "crypto";
import { config } from "./config";

export class EmailService {
  private transporter: nodemailer.Transporter | null;
  private baseUrl: string;

  constructor() {
    this.baseUrl = config.baseUrl;

    if (!config.emailFeaturesEnabled) {
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: config.smtpHost || "smtp.ethereal.email",
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser || undefined,
        pass: config.smtpPass || undefined,
      },
    });
  }

  /**
   * Generate a random token
   */
  static generateToken(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Send email verification email
   */
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    if (!this.transporter) {
      return;
    }
    const verificationUrl = `${this.baseUrl}/auth/verify?token=${token}`;

    try {
      const info = await this.transporter.sendMail({
        from: config.smtpFrom || '"Todo App" <noreply@todoapp.com>',
        to: email,
        subject: "Verify your email address",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Todo App!</h2>
            <p>Please verify your email address by clicking the button below:</p>
            <p style="margin: 30px 0;">
              <a href="${verificationUrl}"
                 style="background-color: #667eea; color: white; padding: 12px 24px;
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Verify Email Address
              </a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #666; font-size: 14px;">${verificationUrl}</p>
            <p style="color: #999; font-size: 12px; margin-top: 40px;">
              If you didn't create an account, please ignore this email.
            </p>
          </div>
        `,
      });

      console.log("Verification email sent:", info.messageId);
      if (process.env.NODE_ENV === "development") {
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
      }
    } catch (error) {
      console.error("Error sending verification email:", error);
      throw new Error("Failed to send verification email");
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    if (!this.transporter) {
      return;
    }
    const resetUrl = `${this.baseUrl}/reset-password?token=${token}`;

    try {
      const info = await this.transporter.sendMail({
        from: config.smtpFrom || '"Todo App" <noreply@todoapp.com>',
        to: email,
        subject: "Reset your password",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Password Reset Request</h2>
            <p>You requested to reset your password. Click the button below to reset it:</p>
            <p style="margin: 30px 0;">
              <a href="${resetUrl}"
                 style="background-color: #667eea; color: white; padding: 12px 24px;
                        text-decoration: none; border-radius: 5px; display: inline-block;">
                Reset Password
              </a>
            </p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="color: #666; font-size: 14px;">${resetUrl}</p>
            <p style="color: #ff4757; margin-top: 20px;">
              This link will expire in 1 hour.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 40px;">
              If you didn't request a password reset, please ignore this email.
            </p>
          </div>
        `,
      });

      console.log("Password reset email sent:", info.messageId);
      if (process.env.NODE_ENV === "development") {
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
      }
    } catch (error) {
      console.error("Error sending password reset email:", error);
      throw new Error("Failed to send password reset email");
    }
  }
}
