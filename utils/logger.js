// utils/logger.js - Production-ready logging utility

const config = require("../config/config");

class Logger {
  constructor(level = "info") {
    this.level = level;
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta,
    };

    return JSON.stringify(logEntry);
  }

  error(message, meta = {}) {
    if (this.shouldLog("error")) {
      console.error(this.formatMessage("error", message, meta));
    }
  }

  warn(message, meta = {}) {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message, meta));
    }
  }

  info(message, meta = {}) {
    if (this.shouldLog("info")) {
      console.info(this.formatMessage("info", message, meta));
    }
  }

  debug(message, meta = {}) {
    if (this.shouldLog("debug")) {
      console.debug(this.formatMessage("debug", message, meta));
    }
  }

  // For request logging
  logRequest(req, res, startTime) {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method || "UNKNOWN",
      path: req.url || "UNKNOWN",
      statusCode: res.statusCode || 0,
      duration: `${duration}ms`,
      ip: this.getClientIP(req),
      userAgent: req.headers ? req.headers["user-agent"] : "UNKNOWN",
    };

    this.info("HTTP Request", logData);
  }

  // For authentication logging
  logAuth(userId, action, success, details = {}) {
    this.info("Auth Event", {
      userId,
      action,
      success,
      ...details,
    });
  }

  // For Prima789 API logging
  logPrimaAPI(action, success, duration, details = {}) {
    this.info("Prima789 API", {
      action,
      success,
      duration: `${duration}ms`,
      ...details,
    });
  }

  // Get client IP (works with Netlify Functions)
  getClientIP(req) {
    return (
      req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      req.connection?.remoteAddress ||
      "unknown"
    );
  }
}

// Export singleton instance
module.exports = new Logger(config.app.logLevel);
