// utils/errors.js - Centralized error handling

const logger = require("./logger");

class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400, "VALIDATION_ERROR");
    this.field = field;
  }
}

class AuthenticationError extends AppError {
  constructor(message = "Authentication failed") {
    super(message, 401, "AUTHENTICATION_ERROR");
  }
}

class AuthorizationError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403, "AUTHORIZATION_ERROR");
  }
}

class ExternalAPIError extends AppError {
  constructor(message, service = "unknown") {
    super(message, 502, "EXTERNAL_API_ERROR");
    this.service = service;
  }
}

class DatabaseError extends AppError {
  constructor(message) {
    super(message, 500, "DATABASE_ERROR");
  }
}

// Error response formatter
function formatErrorResponse(error, includeStack = false) {
  const response = {
    error: {
      message: error.message || "An unexpected error occurred",
      code: error.code || "INTERNAL_ERROR",
      ...(error.field && { field: error.field }),
      ...(error.service && { service: error.service }),
    },
  };

  if (includeStack && error.stack) {
    response.error.stack = error.stack;
  }

  return response;
}

// Main error handler for Netlify Functions
function handleError(error, event = {}) {
  const isDevelopment = process.env.NODE_ENV !== "production";

  logger.error("Application Error", {
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    stack: error.stack,
    path: event.path,
    method: event.httpMethod,
    ip: event.headers ? event.headers["x-forwarded-for"] : "unknown",
  });

  // Determine status code
  let statusCode = 500;
  if (error.isOperational && error.statusCode) {
    statusCode = error.statusCode;
  }

  // Format response
  const response = formatErrorResponse(error, isDevelopment);

  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(response),
  };
}

// Async wrapper to catch all errors
function asyncHandler(fn) {
  return (event, context) => {
    return Promise.resolve(fn(event, context)).catch((error) => {
      return handleError(error, event);
    });
  };
}

// Validation helpers
function validateRequired(value, fieldName) {
  if (!value || (typeof value === "string" && value.trim() === "")) {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
}

function validatePhoneNumber(phone) {
  const phoneRegex = /^[0-9]{10}$/;
  if (!phoneRegex.test(phone.replace(/[-\s]/g, ""))) {
    throw new ValidationError("Invalid phone number format", "username");
  }
}

function validatePIN(pin) {
  const pinRegex = /^[0-9]{4}$/;
  if (!pinRegex.test(pin)) {
    throw new ValidationError("PIN must be 4 digits", "password");
  }
}

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ExternalAPIError,
  DatabaseError,
  handleError,
  asyncHandler,
  formatErrorResponse,
  validateRequired,
  validatePhoneNumber,
  validatePIN,
  validatePhoneNumberOrThrow,
  validatePINOrThrow,
};
