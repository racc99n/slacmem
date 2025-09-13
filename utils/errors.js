// utils/errors.js - Production-ready error handling (FIXED)

/**
 * Base Application Error Class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation Error Class
 */
class ValidationError extends AppError {
  constructor(message, field = null, code = "VALIDATION_ERROR") {
    super(message, 400, code);
    this.name = "ValidationError";
    this.field = field;
  }
}

/**
 * Authentication Error Class
 */
class AuthenticationError extends AppError {
  constructor(message = "Authentication failed", code = "AUTH_ERROR") {
    super(message, 401, code);
    this.name = "AuthenticationError";
  }
}

/**
 * Authorization Error Class
 */
class AuthorizationError extends AppError {
  constructor(message = "Access denied", code = "ACCESS_DENIED") {
    super(message, 403, code);
    this.name = "AuthorizationError";
  }
}

/**
 * Database Error Class
 */
class DatabaseError extends AppError {
  constructor(message = "Database operation failed", code = "DB_ERROR") {
    super(message, 500, code);
    this.name = "DatabaseError";
  }
}

/**
 * External API Error Class
 */
class ExternalAPIError extends AppError {
  constructor(
    message = "External API error",
    service = "unknown",
    code = "API_ERROR"
  ) {
    super(message, 503, code);
    this.name = "ExternalAPIError";
    this.service = service;
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
      const statusCode = error.statusCode || 500;
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
  // Patterns: 08x, 09x, 06x (10 digits total)
  const phonePattern = /^0[689]\d{8}$/;
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
    .replace(/[\\]/g, "") // Remove backslashes
    .substring(0, 1000); // Limit length
}

/**
 * Create standardized error response
 * @param {Error} error - Error object
 * @param {number} defaultStatus - Default status code
 * @returns {Object} Error response object
 */
function createErrorResponse(error, defaultStatus = 500) {
  const statusCode = error.statusCode || defaultStatus;

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

/**
 * Handle different types of errors and return appropriate response
 * @param {Error} error - Error object
 * @param {Object} event - Lambda event object (optional)
 * @returns {Object} HTTP response object
 */
function handleError(error, event = {}) {
  // Log error with context
  console.error("Error handled:", {
    name: error.name,
    message: error.message,
    code: error.code,
    stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    path: event.path,
    method: event.httpMethod,
    timestamp: new Date().toISOString(),
  });

  // Return appropriate response based on error type
  if (error instanceof ValidationError) {
    return createErrorResponse(error, 400);
  } else if (error instanceof AuthenticationError) {
    return createErrorResponse(error, 401);
  } else if (error instanceof AuthorizationError) {
    return createErrorResponse(error, 403);
  } else if (error instanceof DatabaseError) {
    return createErrorResponse(error, 500);
  } else if (error instanceof ExternalAPIError) {
    return createErrorResponse(error, 503);
  } else {
    // Unknown error - don't expose internal details
    const safeError = new AppError(
      process.env.NODE_ENV === "development"
        ? error.message
        : "An unexpected error occurred",
      500,
      "INTERNAL_ERROR"
    );
    return createErrorResponse(safeError, 500);
  }
}

// Export all error classes and utility functions
module.exports = {
  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  DatabaseError,
  ExternalAPIError,

  // Utility functions
  asyncHandler,
  createErrorResponse,
  handleError,

  // Validation functions (boolean return)
  validateRequired,
  validatePhoneNumber,
  validatePIN,
  validateEmail,
  validateLength,

  // Validation functions (throw on error)
  validatePhoneNumberOrThrow,
  validatePINOrThrow,

  // Utility functions
  sanitizeInput,
};
