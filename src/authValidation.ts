import { RegisterDto, LoginDto } from './authService';

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * Requirements: at least 8 characters
 */
function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

/**
 * Validate registration data
 */
export function validateRegister(data: any): { valid: boolean; errors: ValidationError[]; dto?: RegisterDto } {
  const errors: ValidationError[] = [];

  // Email validation
  if (!data.email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (typeof data.email !== 'string') {
    errors.push({ field: 'email', message: 'Email must be a string' });
  } else {
    const trimmedEmail = data.email.trim();
    if (trimmedEmail === '') {
      errors.push({ field: 'email', message: 'Email cannot be empty' });
    } else if (trimmedEmail.length > 255) {
      errors.push({ field: 'email', message: 'Email cannot exceed 255 characters' });
    } else if (!isValidEmail(trimmedEmail)) {
      errors.push({ field: 'email', message: 'Invalid email format' });
    }
  }

  // Password validation
  if (!data.password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else if (typeof data.password !== 'string') {
    errors.push({ field: 'password', message: 'Password must be a string' });
  } else if (!isValidPassword(data.password)) {
    errors.push({ field: 'password', message: 'Password must be at least 8 characters long' });
  }

  // Name validation (optional)
  if (data.name !== undefined && data.name !== null) {
    if (typeof data.name !== 'string') {
      errors.push({ field: 'name', message: 'Name must be a string' });
    } else if (data.name.trim().length > 100) {
      errors.push({ field: 'name', message: 'Name cannot exceed 100 characters' });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const dto: RegisterDto = {
    email: data.email.trim().toLowerCase(),
    password: data.password,
  };

  if (data.name && typeof data.name === 'string' && data.name.trim() !== '') {
    dto.name = data.name.trim();
  }

  return { valid: true, errors: [], dto };
}

/**
 * Validate login data
 */
export function validateLogin(data: any): { valid: boolean; errors: ValidationError[]; dto?: LoginDto } {
  const errors: ValidationError[] = [];

  // Email validation
  if (!data.email) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (typeof data.email !== 'string') {
    errors.push({ field: 'email', message: 'Email must be a string' });
  } else if (data.email.trim() === '') {
    errors.push({ field: 'email', message: 'Email cannot be empty' });
  }

  // Password validation
  if (!data.password) {
    errors.push({ field: 'password', message: 'Password is required' });
  } else if (typeof data.password !== 'string') {
    errors.push({ field: 'password', message: 'Password must be a string' });
  } else if (data.password === '') {
    errors.push({ field: 'password', message: 'Password cannot be empty' });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const dto: LoginDto = {
    email: data.email.trim().toLowerCase(),
    password: data.password,
  };

  return { valid: true, errors: [], dto };
}
