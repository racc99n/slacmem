// utils/security.js - Security utilities and middleware

const crypto = require("crypto");
const config = require("../config/config");
const logger = require("./logger");

class SecurityUtils {
  constructor() {
    this.rateLimitMap = new Map();
    this.suspiciousIPs = new Set();
    this.blockedIPs = new Set();
  }

  /**
   * Sanitize input to prevent XSS and injection attacks
   * @param {string} input - Input string to sanitize
   * @returns {string} Sanitized string
   */
  sanitizeInput(input) {
    if (typeof input !== "string") return input;

    return input
      .trim()
      .replace(/[<>]/g, "") // Remove potential HTML tags
      .replace(/['"]/g, "") // Remove quotes
      .replace(/[\\]/g, "") // Remove backslashes
      .substring(0, 1000); // Limit length
  }

  /**
   * Validate phone number format (Thai mobile numbers)
   * @param {string} phone - Phone number to validate
   * @returns {boolean} True if valid
   */
  validatePhoneNumber(phone) {
    if (!phone || typeof phone !== "string") return false;

    const cleanPhone = phone.replace(/[-\s\(\)]/g, "");
    return /^(0[689]\d{8}|[689]\d{8})$/.test(cleanPhone);
  }

  /**
   * Validate PIN format
   * @param {string} pin - PIN to validate
   * @returns {boolean} True if valid
   */
  validatePIN(pin) {
    if (!pin || typeof pin !== "string") return false;
    return /^\d{4}$/.test(pin);
  }

  /**
   * Generate secure hash
   * @param {string} data - Data to hash
   * @param {string} salt - Salt for hashing
   * @returns {string} Hashed value
   */
  generateHash(data, salt = "") {
    return crypto
      .createHash("sha256")
      .update(data + salt + config.security.jwtSecret)
      .digest("hex");
  }

  /**
   * Generate secure random token
   * @param {number} length - Token length
   * @returns {string} Random token
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString("hex");
  }

  /**
   * Detect suspicious activity patterns
   * @param {string} ip - Client IP address
   * @param {string} userAgent - User agent string
   * @param {string} action - Action being performed
   * @returns {Object} Security assessment
   */
  detectSuspiciousActivity(ip, userAgent, action) {
    const assessment = {
      isSuspicious: false,
      shouldBlock: false,
      reasons: [],
    };

    // Check if IP is already blocked
    if (this.blockedIPs.has(ip)) {
      assessment.shouldBlock = true;
      assessment.reasons.push("IP_BLOCKED");
      return assessment;
    }

    // Check for rapid requests from same IP
    const ipKey = `${ip}_${action}`;
    const now = Date.now();
    const requests = this.rateLimitMap.get(ipKey) || [];

    // Clean old requests (older than 1 minute)
    const recentRequests = requests.filter((time) => now - time < 60000);

    if (recentRequests.length > 10) {
      assessment.isSuspicious = true;
      assessment.reasons.push("RAPID_REQUESTS");
      this.suspiciousIPs.add(ip);
    }

    // Update rate limit map
    recentRequests.push(now);
    this.rateLimitMap.set(ipKey, recentRequests);

    // Check for suspicious user agents
    if (this.isSuspiciousUserAgent(userAgent)) {
      assessment.isSuspicious = true;
      assessment.reasons.push("SUSPICIOUS_USER_AGENT");
    }

    // Check for known attack patterns
    if (this.hasAttackPatterns(userAgent)) {
      assessment.shouldBlock = true;
      assessment.reasons.push("ATTACK_PATTERN");
      this.blockedIPs.add(ip);
    }

    // Log suspicious activity
    if (assessment.isSuspicious || assessment.shouldBlock) {
      logger.warn("Suspicious activity detected", {
        ip,
        userAgent: userAgent?.substring(0, 100),
        action,
        assessment,
      });
    }

    return assessment;
  }

  /**
   * Check if user agent is suspicious
   * @param {string} userAgent - User agent string
   * @returns {boolean} True if suspicious
   */
  isSuspiciousUserAgent(userAgent) {
    if (!userAgent || typeof userAgent !== "string") return true;

    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /php/i,
    ];

    return suspiciousPatterns.some((pattern) => pattern.test(userAgent));
  }

  /**
   * Check for known attack patterns
   * @param {string} userAgent - User agent string
   * @returns {boolean} True if contains attack patterns
   */
  hasAttackPatterns(userAgent) {
    if (!userAgent) return false;

    const attackPatterns = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /masscan/i,
      /zap/i,
      /burp/i,
      /dirb/i,
      /gobuster/i,
    ];

    return attackPatterns.some((pattern) => pattern.test(userAgent));
  }

  /**
   * Security middleware for Netlify Functions
   * @param {Object} event - Netlify event object
   * @returns {Object|null} Security response or null to continue
   */
  securityMiddleware(event) {
    const ip =
      event.headers["x-forwarded-for"] ||
      event.headers["x-real-ip"] ||
      "unknown";
    const userAgent = event.headers["user-agent"] || "";
    const method = event.httpMethod || "UNKNOWN";
    const path = event.path || "";

    // Basic security checks
    const assessment = this.detectSuspiciousActivity(
      ip,
      userAgent,
      `${method}_${path}`
    );

    if (assessment.shouldBlock) {
      logger.error("Request blocked by security middleware", {
        ip,
        userAgent: userAgent.substring(0, 100),
        method,
        path,
        reasons: assessment.reasons,
      });

      return {
        statusCode: 403,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: {
            message: "Access denied",
            code: "SECURITY_VIOLATION",
          },
        }),
      };
    }

    // Check request size
    if (event.body && event.body.length > 10000) {
      logger.warn("Request body too large", {
        ip,
        size: event.body.length,
        path,
      });

      return {
        statusCode: 413,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({
          error: {
            message: "Request too large",
            code: "REQUEST_TOO_LARGE",
          },
        }),
      };
    }

    // Check for SQL injection attempts in query parameters
    if (event.queryStringParameters) {
      for (const [key, value] of Object.entries(event.queryStringParameters)) {
        if (this.containsSQLInjection(value)) {
          logger.error("SQL injection attempt detected", {
            ip,
            parameter: key,
            value: value?.substring(0, 100),
          });

          this.blockedIPs.add(ip);

          return {
            statusCode: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
              error: {
                message: "Invalid request",
                code: "INVALID_INPUT",
              },
            }),
          };
        }
      }
    }

    return null; // Continue processing
  }

  /**
   * Check for SQL injection patterns
   * @param {string} input - Input to check
   * @returns {boolean} True if contains SQL injection patterns
   */
  containsSQLInjection(input) {
    if (!input || typeof input !== "string") return false;

    const sqlPatterns = [
      /('|(\\)|;|--|#|\*|\/\*|\*\/)/i,
      /(union|select|insert|update|delete|drop|create|alter|exec|execute)/i,
      /(script|javascript|vbscript|onload|onerror|onclick)/i,
    ];

    return sqlPatterns.some((pattern) => pattern.test(input));
  }

  /**
   * Generate Content Security Policy header
   * @returns {string} CSP header value
   */
  generateCSP() {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://static.line-scdn.net https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://api.line.me https://prima789.net https://*.netlify.app",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");
  }

  /**
   * Get security headers for responses
   * @returns {Object} Security headers
   */
  getSecurityHeaders() {
    return {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": this.generateCSP(),
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Permitted-Cross-Domain-Policies": "none",
    };
  }

  /**
   * Cleanup old entries to prevent memory leaks
   */
  cleanup() {
    const now = Date.now();

    // Clean rate limit map
    for (const [key, requests] of this.rateLimitMap.entries()) {
      const recentRequests = requests.filter((time) => now - time < 300000); // 5 minutes
      if (recentRequests.length === 0) {
        this.rateLimitMap.delete(key);
      } else {
        this.rateLimitMap.set(key, recentRequests);
      }
    }

    // Clean suspicious IPs (reset every hour)
    if (this.lastCleanup && now - this.lastCleanup > 3600000) {
      this.suspiciousIPs.clear();
    }

    this.lastCleanup = now;
  }
}

// Run cleanup every 5 minutes
setInterval(() => {
  securityUtils.cleanup();
}, 5 * 60 * 1000);

// Export singleton instance
const securityUtils = new SecurityUtils();
module.exports = securityUtils;
