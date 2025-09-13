// utils/errors.js - Production-ready error handling

/**
 * Custom error classes for the application
 */
class ValidationError extends Error {
  constructor(message, field = null, code = "VALIDATION_ERROR") {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.code = code;
    this.status = 400;
  }
}

class AuthenticationError extends Error {
  constructor(message = "Authentication failed", code = "AUTH_ERROR") {
    super(message);
    this.name = "AuthenticationError";
    this.code = code;
    this.status = 401;
  }
}

class AuthorizationError extends Error {
  constructor(message = "Access denied", code = "ACCESS_DENIED") {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
    this.status = 403;
  }
}

class DatabaseError extends Error {
  constructor(message = "Database operation failed", code = "DB_ERROR") {
    super(message);
    this.name = "DatabaseError";
    this.code = code;
    this.status = 500;
  }
}

class ExternalServiceError extends Error {
  constructor(
    message = "External service error",
    service = "unknown",
    code = "SERVICE_ERROR"
  ) {
    super(message);
    this.name = "ExternalServiceError";
    this.service = service;
    this.code = code;
    this.status = 503;
  }
}

/**
 * Async handler wrapper for better error handling
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function
 */
function asyncHandler(fn) {
  return (event, context) => {
    return Promise.resolve(fn(event, context)).catch((error) => {
      // Log error for debugging
      console.error("AsyncHandler caught error:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        field: error.field,
      });

      // Return proper error response
      const statusCode = error.status || 500;
      const errorResponse = {
        error: {
          message: error.message,
          code: error.code || "UNKNOWN_ERROR",
          ...(error.field && { field: error.field }),
        },
      };

      return {
        statusCode,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        },
        body: JSON.stringify(errorResponse),
      };
    });
  };
}

/**
 * Validate required field
 * @param {any} value - Value to validate
 * @param {string} fieldName - Field name for error message
 * @throws {ValidationError} If value is missing
 */
function validateRequired(value, fieldName) {
  if (!value || (typeof value === "string" && value.trim() === "")) {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
}

/**
 * Validate phone number format (Thai mobile numbers)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== "string") {
    return false;
  }

  // Clean phone number (remove spaces, dashes, parentheses)
  const cleanPhone = phone.replace(/[-\s\(\)]/g, "");

  // Validate Thai mobile number format
  // Patterns: 08x, 09x, 06x (with or without leading 0)
  const phonePattern = /^(0[689]\d{8}|[689]\d{8})$/;
  return phonePattern.test(cleanPhone);
}

/**
 * Validate PIN format
 * @param {string} pin - PIN to validate
 * @returns {boolean} True if valid
 */
function validatePIN(pin) {
  if (!pin || typeof pin !== "string") {
    return false;
  }

  // PIN must be exactly 4 digits
  return /^\d{4}$/.test(pin);
}

/**
 * Validate phone number and throw error if invalid
 * @param {string} phone - Phone number to validate
 * @throws {ValidationError} If phone number is invalid
 */
function validatePhoneNumberOrThrow(phone) {
  if (!phone || typeof phone !== "string") {
    throw new ValidationError("Phone number is required", "username");
  }

  if (!validatePhoneNumber(phone)) {
    throw new ValidationError(
      "Invalid phone number format (must be Thai mobile number: 08x, 09x, or 06x)",
      "username"
    );
  }
}

/**
 * Validate PIN and throw error if invalid
 * @param {string} pin - PIN to validate
 * @throws {ValidationError} If PIN is invalid
 */
function validatePINOrThrow(pin) {
  if (!pin || typeof pin !== "string") {
    throw new ValidationError("PIN is required", "password");
  }

  if (!validatePIN(pin)) {
    throw new ValidationError("PIN must be exactly 4 digits", "password");
  }
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function validateEmail(email) {
  if (!email || typeof email !== "string") {
    return false;
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

/**
 * Validate string length
 * @param {string} str - String to validate
 * @param {number} minLength - Minimum length
 * @param {number} maxLength - Maximum length
 * @returns {boolean} True if valid
 */
function validateLength(str, minLength, maxLength) {
  if (!str || typeof str !== "string") {
    return false;
  }

  return str.length >= minLength && str.length <= maxLength;
}

/**
 * Sanitize input string
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeInput(input) {
  if (!input || typeof input !== "string") {
    return "";
  }

  return input
    .trim()
    .replace(/[<>]/g, "") // Remove HTML tags
    .replace(/['"]/g, "") // Remove quotes
    .substring(0, 1000); // Limit length
}

/**
 * Create standardized error response
 * @param {Error} error - Error object
 * @param {number} defaultStatus - Default status code
 * @returns {Object} Error response object
 */
function createErrorResponse(error, defaultStatus = 500) {
  const statusCode = error.status || defaultStatus;

  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
    body: JSON.stringify({
      error: {
        message: error.message,
        code: error.code || "UNKNOWN_ERROR",
        ...(error.field && { field: error.field }),
        ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
      },
    }),
  };
}

module.exports = {
  // Error classes
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  ExternalServiceError,

  // Utility functions
  asyncHandler,
  createErrorResponse,

  // Validation functions
  validateRequired,
  validatePhoneNumber,
  validatePIN,
  validatePhoneNumberOrThrow, // ← เพิ่มฟังก์ชันที่หายไป
  validatePINOrThrow, // ← เพิ่มฟังก์ชันที่หายไป
  validateEmail,
  validateLength,

  // Utility functions
  sanitizeInput,
};
