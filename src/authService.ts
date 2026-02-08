import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { EmailService } from './emailService';
import { config } from './config';

export interface RegisterDto {
  email: string;
  password: string;
  name?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  token: string;
  refreshToken?: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
}

export class AuthService {
  private readonly SALT_ROUNDS = 10;
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN = '15m'; // Short-lived access token
  private readonly REFRESH_TOKEN_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  private emailService: EmailService;

  constructor(private prisma: PrismaClient) {
    this.JWT_SECRET = process.env.JWT_SECRET || config.jwtSecret;
    this.emailService = new EmailService();
  }

  /**
   * Register a new user
   * @throws Error if email already exists or validation fails
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, this.SALT_ROUNDS);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
      },
    });

    // Send verification email
    try {
      await this.sendVerificationEmail(user.id);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // Continue anyway - user can resend later
    }

    // Generate JWT token and refresh token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
    });
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
      refreshToken,
    };
  }

  /**
   * Login user with email and password
   * @throws Error if credentials are invalid
   */
  async login(dto: LoginDto): Promise<AuthResponse> {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new Error('Invalid credentials');
    }

    // Generate JWT token and refresh token
    const token = this.generateToken({
      userId: user.id,
      email: user.email,
    });
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      token,
      refreshToken,
    };
  }

  /**
   * Verify JWT token and return payload
   * @throws Error if token is invalid or expired
   */
  verifyToken(token: string): JwtPayload {
    try {
      const payload = jwt.verify(token, this.JWT_SECRET) as JwtPayload;
      return payload;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw new Error('Token verification failed');
    }
  }

  /**
   * Generate JWT token for user
   */
  private generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN,
    });
  }

  /**
   * Get user by ID (without password)
   */
  async getUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        isVerified: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Get user by email (including verification status)
   */
  async getUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        isVerified: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Update user profile
   * @throws Error if email already in use
   */
  async updateUserProfile(userId: string, data: { name?: string | null; email?: string }) {
    // Normalize email to lowercase to match registration/login behavior
    const normalizedEmail = data.email ? data.email.trim().toLowerCase() : undefined;

    // If email is being updated, check if it's already in use
    if (normalizedEmail) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          NOT: { id: userId },
        },
      });

      if (existingUser) {
        throw new Error('Email already in use');
      }
    }

    // Check if the email is actually changing
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    const emailIsChanging = normalizedEmail && currentUser && normalizedEmail !== currentUser.email;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: data.name,
        email: normalizedEmail,
        // Reset verification when email changes
        ...(emailIsChanging && { isVerified: false, verificationToken: null }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        isVerified: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Send new verification email when email changes
    if (emailIsChanging) {
      try {
        await this.sendVerificationEmail(userId);
      } catch (error) {
        console.error('Failed to send verification email after email change:', error);
        // Continue anyway - user can resend later
      }
    }

    return updatedUser;
  }

  /**
   * Create a refresh token for a user
   */
  private async createRefreshToken(userId: string): Promise<string> {
    const token = jwt.sign({ userId, jti: randomUUID() }, this.JWT_SECRET, {
      expiresIn: '7d',
    });

    const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRES_IN);

    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
      },
    });

    return token;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      jwt.verify(refreshToken, this.JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });

    if (!storedToken) {
      throw new Error('Refresh token not found');
    }

    if (storedToken.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new Error('Refresh token expired');
    }

    const newAccessToken = this.generateToken({
      userId: storedToken.user.id,
      email: storedToken.user.email,
    });

    await this.prisma.refreshToken.delete({
      where: { id: storedToken.id },
    });

    const newRefreshToken = await this.createRefreshToken(storedToken.user.id);

    return {
      token: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Revoke a refresh token
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    const token = EmailService.generateToken();
    await this.prisma.user.update({
      where: { id: userId },
      data: { verificationToken: token },
    });

    await this.emailService.sendVerificationEmail(user.email, token);
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { verificationToken: token },
    });

    if (!user) throw new Error('Invalid verification token');

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
      },
    });
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if email exists
      return;
    }

    const token = EmailService.generateToken();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiry: expiry,
      },
    });

    await this.emailService.sendPasswordResetEmail(user.email, token);
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { resetToken: token },
    });

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      throw new Error('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    // Update password and revoke all refresh tokens in parallel
    await Promise.all([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
        },
      }),
      this.prisma.refreshToken.deleteMany({
        where: { userId: user.id },
      }),
    ]);
  }

  /**
   * Check if user is admin
   */
  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user?.role === 'admin';
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update user role (admin only)
   */
  async updateUserRole(userId: string, role: 'user' | 'admin'): Promise<void> {
    if (!['user', 'admin'].includes(role)) {
      throw new Error('Invalid role');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  /**
   * Delete user (admin only)
   */
  async deleteUser(userId: string): Promise<void> {
    await this.prisma.user.delete({ where: { id: userId } });
  }
}
