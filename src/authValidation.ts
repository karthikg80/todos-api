import { RegisterDto, LoginDto } from "./authService";

export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (email.length > 255) {
    return false;
  }

  const atIndex = email.indexOf("@");
  if (atIndex <= 0 || atIndex !== email.lastIndexOf("@")) {
    return false;
  }

  const localPart = email.slice(0, atIndex);
  const domainPart = email.slice(atIndex + 1);

  if (localPart.length === 0 || localPart.length > 64) {
    return false;
  }
  if (domainPart.length < 3 || domainPart.length > 253) {
    return false;
  }
  if (localPart.startsWith(".") || localPart.endsWith(".")) {
    return false;
  }
  if (email.includes("..")) {
    return false;
  }

  const localPartRegex = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
  if (!localPartRegex.test(localPart)) {
    return false;
  }

  const domainLabels = domainPart.split(".");
  if (domainLabels.length < 2) {
    return false;
  }

  for (const label of domainLabels) {
    if (label.length === 0 || label.length > 63) {
      return false;
    }
    if (label.startsWith("-") || label.endsWith("-")) {
      return false;
    }
    if (!/^[A-Za-z0-9-]+$/.test(label)) {
      return false;
    }
  }

  const tld = domainLabels[domainLabels.length - 1];
  if (!/^[A-Za-z]{2,}$/.test(tld)) {
    return false;
  }

  return true;
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
export function validateRegister(data: any): {
  valid: boolean;
  errors: ValidationError[];
  dto?: RegisterDto;
} {
  const errors: ValidationError[] = [];

  // Email validation
  if (!data.email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (typeof data.email !== "string") {
    errors.push({ field: "email", message: "Email must be a string" });
  } else {
    const trimmedEmail = data.email.trim();
    if (trimmedEmail === "") {
      errors.push({ field: "email", message: "Email cannot be empty" });
    } else if (trimmedEmail.length > 255) {
      errors.push({
        field: "email",
        message: "Email cannot exceed 255 characters",
      });
    } else if (!isValidEmail(trimmedEmail)) {
      errors.push({ field: "email", message: "Invalid email format" });
    }
  }

  // Password validation
  if (!data.password) {
    errors.push({ field: "password", message: "Password is required" });
  } else if (typeof data.password !== "string") {
    errors.push({ field: "password", message: "Password must be a string" });
  } else if (!isValidPassword(data.password)) {
    errors.push({
      field: "password",
      message: "Password must be at least 8 characters long",
    });
  } else if (data.password.length > 72) {
    errors.push({
      field: "password",
      message: "Password cannot exceed 72 characters",
    });
  }

  // Name validation (optional)
  if (data.name !== undefined && data.name !== null) {
    if (typeof data.name !== "string") {
      errors.push({ field: "name", message: "Name must be a string" });
    } else if (data.name.trim().length > 100) {
      errors.push({
        field: "name",
        message: "Name cannot exceed 100 characters",
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const dto: RegisterDto = {
    email: data.email.trim().toLowerCase(),
    password: data.password,
  };

  if (data.name && typeof data.name === "string" && data.name.trim() !== "") {
    dto.name = data.name.trim();
  }

  return { valid: true, errors: [], dto };
}

/**
 * Validate login data
 */
export function validateLogin(data: any): {
  valid: boolean;
  errors: ValidationError[];
  dto?: LoginDto;
} {
  const errors: ValidationError[] = [];

  // Email validation
  if (!data.email) {
    errors.push({ field: "email", message: "Email is required" });
  } else if (typeof data.email !== "string") {
    errors.push({ field: "email", message: "Email must be a string" });
  } else if (data.email.trim() === "") {
    errors.push({ field: "email", message: "Email cannot be empty" });
  }

  // Password validation
  if (!data.password) {
    errors.push({ field: "password", message: "Password is required" });
  } else if (typeof data.password !== "string") {
    errors.push({ field: "password", message: "Password must be a string" });
  } else if (data.password === "") {
    errors.push({ field: "password", message: "Password cannot be empty" });
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
