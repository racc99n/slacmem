// services/prima789Service.js - Production-ready Prima789 integration service

const { io } = require("socket.io-client");
const config = require("../config/config");
const logger = require("../utils/logger");
const { ExternalAPIError, ValidationError } = require("../utils/errors");

class Prima789Service {
  constructor() {
    this.apiUrl = config.prima789.apiUrl;
    this.timeout = config.prima789.timeout;
    this.retryAttempts = config.prima789.retryAttempts;
    this.retryDelay = config.prima789.retryDelay;
  }

  /**
   * Authenticate user with Prima789 system
   * @param {string} phone - User's phone number
   * @param {string} pin - User's PIN (4 digits)
   * @returns {Promise<Object>} User data from Prima789
   * @throws {ValidationError} If credentials format is invalid
   * @throws {ExternalAPIError} If authentication fails
   */
  async authenticateUser(phone, pin) {
    // Input validation
    this.validateCredentials(phone, pin);

    const startTime = Date.now();
    let attempts = 0;
    let lastError = null;

    while (attempts < this.retryAttempts) {
      attempts++;

      try {
        logger.debug("Prima789 authentication attempt", {
          attempt: attempts,
          phone: phone.replace(/\d(?=\d{4})/g, "*"), // Mask phone number
          maxAttempts: this.retryAttempts,
        });

        const userData = await this.performAuthentication(phone, pin);
        const duration = Date.now() - startTime;

        logger.logPrimaAPI("authenticate", true, duration, {
          username: userData.primaUsername,
          attempts,
        });

        return userData;
      } catch (error) {
        lastError = error;

        logger.warn("Prima789 authentication failed", {
          attempt: attempts,
          error: error.message,
          phone: phone.replace(/\d(?=\d{4})/g, "*"),
        });

        // Don't retry for validation errors or authentication failures
        if (
          error instanceof ValidationError ||
          error.message.includes("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
        ) {
          break;
        }

        // Wait before retry (except for last attempt)
        if (attempts < this.retryAttempts) {
          await this.delay(this.retryDelay * attempts);
        }
      }
    }

    const duration = Date.now() - startTime;
    logger.logPrimaAPI("authenticate", false, duration, {
      attempts,
      error: lastError?.message,
    });

    throw (
      lastError ||
      new ExternalAPIError(
        "Prima789 authentication failed after all retry attempts",
        "Prima789"
      )
    );
  }

  /**
   * Validate user credentials format
   * @param {string} phone - Phone number
   * @param {string} pin - PIN code
   * @throws {ValidationError} If format is invalid
   */
  validateCredentials(phone, pin) {
    if (!phone || typeof phone !== "string") {
      throw new ValidationError("Phone number is required", "username");
    }

    if (!pin || typeof pin !== "string") {
      throw new ValidationError("PIN is required", "password");
    }

    // Use the boolean validation functions
    if (!validatePhoneNumber(phone)) {
      throw new ValidationError(
        "Invalid phone number format (must be Thai mobile number)",
        "username"
      );
    }

    if (!validatePIN(pin)) {
      throw new ValidationError("PIN must be exactly 4 digits", "password");
    }
  }

  /**
   * Perform actual authentication via Socket.IO
   * @param {string} phone - Phone number
   * @param {string} pin - PIN code
   * @returns {Promise<Object>} User data
   */
  async performAuthentication(phone, pin) {
    return new Promise((resolve, reject) => {
      const socket = io(this.apiUrl, {
        transports: ["polling", "websocket"],
        timeout: this.timeout,
        forceNew: true,
      });

      let isResolved = false;
      const fullMemberData = {};

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          socket.disconnect();
          reject(
            new ExternalAPIError("Prima789 connection timeout", "Prima789")
          );
        }
      }, this.timeout);

      // Connection successful
      socket.on("connect", () => {
        logger.debug("Prima789 Socket.IO connected", {
          socketId: socket.id,
          transport: socket.io.engine.transport.name,
        });

        socket.emit("login", {
          tel: phone,
          pin: pin,
        });
      });

      // Handle customer data response
      socket.on("cus return", (response) => {
        logger.debug("Prima789 cus return received", {
          success: response?.success,
          hasData: !!response?.data,
        });

        if (response && response.success && response.data) {
          const data = response.data;
          fullMemberData.primaUsername = data.mm_user;
          fullMemberData.firstName = data.first_name;
          fullMemberData.lastName = data.last_name;

          // Check if we have all required data
          if (fullMemberData.creditBalance !== undefined && !isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            socket.disconnect();
            resolve(this.formatUserData(fullMemberData));
          }
        } else {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            socket.disconnect();
            reject(
              new ExternalAPIError(
                response?.data?.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
                "Prima789"
              )
            );
          }
        }
      });

      // Handle credit data response
      socket.on("credit_push", (response) => {
        logger.debug("Prima789 credit_push received", {
          success: response?.success,
          hasData: !!response?.data,
        });

        if (response && response.success && response.data) {
          fullMemberData.creditBalance = response.data.total_credit;

          // Check if we have all required data
          if (fullMemberData.primaUsername && !isResolved) {
            isResolved = true;
            clearTimeout(timeoutId);
            socket.disconnect();
            resolve(this.formatUserData(fullMemberData));
          }
        }
      });

      // Handle connection errors
      socket.on("connect_error", (error) => {
        logger.error("Prima789 connection error", {
          error: error.message,
          type: error.type,
        });

        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          reject(
            new ExternalAPIError(
              "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ Prima789 ได้",
              "Prima789"
            )
          );
        }
      });

      // Handle disconnection
      socket.on("disconnect", (reason) => {
        logger.debug("Prima789 socket disconnected", { reason });

        if (!isResolved && reason !== "io client disconnect") {
          isResolved = true;
          clearTimeout(timeoutId);
          reject(
            new ExternalAPIError(
              "การเชื่อมต่อกับ Prima789 ถูกตัดขาด",
              "Prima789"
            )
          );
        }
      });
    });
  }

  /**
   * Format user data for consistent response
   * @param {Object} rawData - Raw data from Prima789
   * @returns {Object} Formatted user data
   */
  formatUserData(rawData) {
    return {
      primaUsername: rawData.primaUsername || "N/A",
      firstName: rawData.firstName || "",
      lastName: rawData.lastName || "",
      fullName:
        `${rawData.firstName || ""} ${rawData.lastName || ""}`.trim() || "N/A",
      creditBalance: this.formatCreditBalance(rawData.creditBalance),
      memberTier: this.determineMemberTier(rawData.creditBalance),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Format credit balance for display
   * @param {number|string} balance - Credit balance
   * @returns {string} Formatted balance
   */
  formatCreditBalance(balance) {
    if (balance === undefined || balance === null) {
      return "N/A";
    }

    const numericBalance = parseFloat(balance);
    if (isNaN(numericBalance)) {
      return "N/A";
    }

    return numericBalance.toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  /**
   * Determine member tier based on credit balance
   * @param {number|string} balance - Credit balance
   * @returns {string} Member tier
   */
  determineMemberTier(balance) {
    const numericBalance = parseFloat(balance);

    if (isNaN(numericBalance)) {
      return "Standard";
    }

    if (numericBalance >= 100000) {
      return "Platinum";
    } else if (numericBalance >= 50000) {
      return "Gold";
    } else if (numericBalance >= 10000) {
      return "Silver";
    } else {
      return "Standard";
    }
  }

  /**
   * Utility function for delay
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Health check for Prima789 connectivity
   * @returns {Promise<boolean>} True if Prima789 is accessible
   */
  async healthCheck() {
    return new Promise((resolve) => {
      const socket = io(this.apiUrl, {
        transports: ["polling"],
        timeout: 5000,
        forceNew: true,
      });

      const timeoutId = setTimeout(() => {
        socket.disconnect();
        resolve(false);
      }, 5000);

      socket.on("connect", () => {
        clearTimeout(timeoutId);
        socket.disconnect();
        resolve(true);
      });

      socket.on("connect_error", () => {
        clearTimeout(timeoutId);
        resolve(false);
      });
    });
  }
}

// Export singleton instance
module.exports = new Prima789Service();
