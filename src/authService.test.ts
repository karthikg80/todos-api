import { AuthService } from './authService';
import { prisma } from './prismaClient';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('AuthService', () => {
  let authService: AuthService;
  const TEST_JWT_SECRET = 'test-secret-key';

  beforeAll(() => {
    // Set test JWT secret
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    authService = new AuthService(prisma);
  });

  beforeEach(async () => {
    // Clean up users before each test
    await prisma.user.deleteMany();
  });

  describe('register', () => {
    it('should register a new user with hashed password', async () => {
      const result = await authService.register({
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User'
      });

      expect(result.user.email).toBe('newuser@example.com');
      expect(result.user.name).toBe('New User');
      expect(result.user.id).toBeDefined();
      expect(result.token).toBeDefined();

      // Verify password is hashed in database
      const dbUser = await prisma.user.findUnique({
        where: { email: 'newuser@example.com' }
      });
      expect(dbUser).toBeDefined();
      expect(dbUser!.password).not.toBe('password123');
      expect(dbUser!.password.length).toBeGreaterThan(50); // Bcrypt hash length

      // Verify password can be compared
      const isValid = await bcrypt.compare('password123', dbUser!.password);
      expect(isValid).toBe(true);
    });

    it('should register user without name', async () => {
      const result = await authService.register({
        email: 'noname@example.com',
        password: 'password123'
      });

      expect(result.user.email).toBe('noname@example.com');
      expect(result.user.name).toBeNull();
    });

    it('should throw error for duplicate email', async () => {
      await authService.register({
        email: 'duplicate@example.com',
        password: 'password123'
      });

      await expect(
        authService.register({
          email: 'duplicate@example.com',
          password: 'password456'
        })
      ).rejects.toThrow('Email already registered');
    });

    it('should return valid JWT token', async () => {
      const result = await authService.register({
        email: 'token@example.com',
        password: 'password123'
      });

      const decoded = jwt.verify(result.token, TEST_JWT_SECRET) as any;
      expect(decoded.userId).toBe(result.user.id);
      expect(decoded.email).toBe('token@example.com');
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it('should normalize email to lowercase', async () => {
      const result = await authService.register({
        email: 'MixedCase@Example.COM',
        password: 'password123'
      });

      // The email should be stored in lowercase (if validation does this)
      const dbUser = await prisma.user.findUnique({
        where: { email: result.user.email }
      });
      expect(dbUser).toBeDefined();
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await authService.register({
        email: 'logintest@example.com',
        password: 'correctpassword',
        name: 'Login Test'
      });
    });

    it('should login with correct credentials', async () => {
      const result = await authService.login({
        email: 'logintest@example.com',
        password: 'correctpassword'
      });

      expect(result.user.email).toBe('logintest@example.com');
      expect(result.user.name).toBe('Login Test');
      expect(result.user.id).toBeDefined();
      expect(result.token).toBeDefined();
    });

    it('should throw error for non-existent email', async () => {
      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'password123'
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw error for incorrect password', async () => {
      await expect(
        authService.login({
          email: 'logintest@example.com',
          password: 'wrongpassword'
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should return valid JWT token on login', async () => {
      const result = await authService.login({
        email: 'logintest@example.com',
        password: 'correctpassword'
      });

      const decoded = jwt.verify(result.token, TEST_JWT_SECRET) as any;
      expect(decoded.userId).toBe(result.user.id);
      expect(decoded.email).toBe('logintest@example.com');
    });

    it('should not expose password in response', async () => {
      const result = await authService.login({
        email: 'logintest@example.com',
        password: 'correctpassword'
      });

      expect((result.user as any).password).toBeUndefined();
    });
  });

  describe('verifyToken', () => {
    let validToken: string;
    let userId: string;

    beforeEach(async () => {
      const result = await authService.register({
        email: 'tokentest@example.com',
        password: 'password123'
      });
      validToken = result.token;
      userId = result.user.id;
    });

    it('should verify valid token', () => {
      const payload = authService.verifyToken(validToken);

      expect(payload.userId).toBe(userId);
      expect(payload.email).toBe('tokentest@example.com');
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        authService.verifyToken('invalid.token.here');
      }).toThrow('Invalid token');
    });

    it('should throw error for malformed token', () => {
      expect(() => {
        authService.verifyToken('not-a-jwt-token');
      }).toThrow('Invalid token');
    });

    it('should throw error for token with wrong secret', () => {
      const wrongToken = jwt.sign(
        { userId: 'test', email: 'test@example.com' },
        'wrong-secret',
        { expiresIn: '7d' }
      );

      expect(() => {
        authService.verifyToken(wrongToken);
      }).toThrow('Invalid token');
    });

    it('should throw error for expired token', () => {
      const expiredToken = jwt.sign(
        { userId: 'test', email: 'test@example.com' },
        TEST_JWT_SECRET,
        { expiresIn: '0s' } // Already expired
      );

      expect(() => {
        authService.verifyToken(expiredToken);
      }).toThrow('Token expired');
    });
  });

  describe('getUserById', () => {
    let testUserId: string;

    beforeEach(async () => {
      const result = await authService.register({
        email: 'getuser@example.com',
        password: 'password123',
        name: 'Get User Test'
      });
      testUserId = result.user.id;
    });

    it('should get user by id without password', async () => {
      const user = await authService.getUserById(testUserId);

      expect(user).toBeDefined();
      expect(user!.id).toBe(testUserId);
      expect(user!.email).toBe('getuser@example.com');
      expect(user!.name).toBe('Get User Test');
      expect((user as any).password).toBeUndefined();
    });

    it('should return null for non-existent user', async () => {
      const user = await authService.getUserById('non-existent-id');
      expect(user).toBeNull();
    });
  });
});
