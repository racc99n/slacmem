// utils/rateLimiter.js - Simple in-memory rate limiter for Netlify Functions

const config = require("../config/config");
const logger = require("./logger");

class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.maxRequests = config.security.rateLimitRequests;
    this.windowMs = config.security.rateLimitWindow;

    // Cleanup old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  // Get client identifier (IP + User-Agent hash for better uniqueness)
  getClientId(event) {
    const ip =
      event.headers["x-forwarded-for"] ||
      event.headers["x-real-ip"] ||
      "unknown";
    const userAgent = event.headers["user-agent"] || "unknown";
    return `${ip}-${this.simpleHash(userAgent)}`;
  }

  // Simple hash function for user agent
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  // Check if request should be allowed
  isAllowed(event) {
    const clientId = this.getClientId(event);
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get or create client record
    if (!this.requests.has(clientId)) {
      this.requests.set(clientId, []);
    }

    const clientRequests = this.requests.get(clientId);

    // Remove old requests outside the window
    const validRequests = clientRequests.filter(
      (timestamp) => timestamp > windowStart
    );
    this.requests.set(clientId, validRequests);

    // Check if limit exceeded
    if (validRequests.length >= this.maxRequests) {
      const oldestRequest = Math.min(...validRequests);
      const resetTime = oldestRequest + this.windowMs;

      logger.warn("Rate limit exceeded", {
        clientId,
        requests: validRequests.length,
        maxRequests: this.maxRequests,
        resetTime: new Date(resetTime).toISOString(),
      });

      return {
        allowed: false,
        resetTime,
        remaining: 0,
      };
    }

    // Add current request
    validRequests.push(now);
    this.requests.set(clientId, validRequests);

    return {
      allowed: true,
      resetTime: now + this.windowMs,
      remaining: this.maxRequests - validRequests.length,
    };
  }

  // Cleanup old entries
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let cleanedCount = 0;

    for (const [clientId, requests] of this.requests.entries()) {
      const validRequests = requests.filter(
        (timestamp) => timestamp > windowStart
      );

      if (validRequests.length === 0) {
        this.requests.delete(clientId);
        cleanedCount++;
      } else {
        this.requests.set(clientId, validRequests);
      }
    }

    if (cleanedCount > 0) {
      logger.debug("Rate limiter cleanup completed", {
        cleanedEntries: cleanedCount,
        remainingEntries: this.requests.size,
      });
    }
  }

  // Middleware function for Netlify Functions
  middleware() {
    return (event) => {
      const result = this.isAllowed(event);

      if (!result.allowed) {
        return {
          statusCode: 429,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Retry-After": Math.ceil(
              (result.resetTime - Date.now()) / 1000
            ).toString(),
            "X-RateLimit-Limit": this.maxRequests.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": result.resetTime.toString(),
          },
          body: JSON.stringify({
            error: {
              message: "Too many requests, please try again later",
              code: "RATE_LIMIT_EXCEEDED",
              retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
            },
          }),
        };
      }

      return null; // Allow request to continue
    };
  }
}

// Export singleton instance
module.exports = new RateLimiter();
