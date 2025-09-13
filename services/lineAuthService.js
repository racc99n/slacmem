// services/lineAuthService.js - Production-ready LINE authentication service

const axios = require("axios");
const config = require("../config/config");
const logger = require("../utils/logger");
const { AuthenticationError, ExternalAPIError } = require("../utils/errors");

class LineAuthService {
  constructor() {
    this.verifyUrl = config.line.verifyUrl;
    this.liffId = config.line.liffId;

    // Configure axios with timeout and retry logic
    this.httpClient = axios.create({
      timeout: 10000,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Prima789-LIFF/1.0",
      },
    });

    // Add request interceptor for logging
    this.httpClient.interceptors.request.use(
      (config) => {
        logger.debug("LINE API Request", {
          url: config.url,
          method: config.method,
        });
        return config;
      },
      (error) => {
        logger.error("LINE API Request Error", { error: error.message });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.httpClient.interceptors.response.use(
      (response) => {
        logger.debug("LINE API Response Success", {
          status: response.status,
          url: response.config.url,
        });
        return response;
      },
      (error) => {
        logger.error("LINE API Response Error", {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Verify LINE ID Token
   * @param {string} idToken - LINE ID Token from LIFF
   * @returns {Promise<Object>} Decoded token payload
   * @throws {AuthenticationError} If token is invalid
   * @throws {ExternalAPIError} If LINE API fails
   */
  async verifyIdToken(idToken) {
    if (!idToken || typeof idToken !== "string") {
      throw new AuthenticationError(
        "ID Token is required and must be a string"
      );
    }

    // Validate token format (basic check)
    if (!idToken.includes(".")) {
      throw new AuthenticationError("Invalid ID Token format");
    }

    const startTime = Date.now();

    try {
      const params = new URLSearchParams({
        id_token: idToken,
        client_id: this.liffId,
      });

      const response = await this.httpClient.post(this.verifyUrl, params);
      const duration = Date.now() - startTime;

      // Validate response structure
      if (!response.data || !response.data.sub) {
        throw new AuthenticationError("Invalid token response from LINE");
      }

      const tokenData = response.data;

      logger.logAuth(tokenData.sub, "token_verify", true, {
        duration: `${duration}ms`,
        aud: tokenData.aud,
      });

      // Return standardized user info
      return {
        lineUserId: tokenData.sub,
        clientId: tokenData.aud,
        issuer: tokenData.iss,
        expiresAt: tokenData.exp,
        issuedAt: tokenData.iat,
        name: tokenData.name,
        picture: tokenData.picture,
        email: tokenData.email,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error.response) {
        // LINE API returned an error response
        const status = error.response.status;
        const errorData = error.response.data;

        logger.logAuth("unknown", "token_verify", false, {
          duration: `${duration}ms`,
          status,
          error: errorData,
        });

        if (status === 400) {
          throw new AuthenticationError("Invalid or expired ID Token");
        } else if (status === 401) {
          throw new AuthenticationError(
            "Unauthorized: Invalid client credentials"
          );
        } else {
          throw new ExternalAPIError(
            `LINE API error: ${errorData.error || "Unknown error"}`,
            "LINE"
          );
        }
      } else if (error.code === "ECONNABORTED") {
        // Timeout error
        logger.logAuth("unknown", "token_verify", false, {
          duration: `${duration}ms`,
          error: "timeout",
        });
        throw new ExternalAPIError("LINE API request timed out", "LINE");
      } else {
        // Network or other error
        logger.logAuth("unknown", "token_verify", false, {
          duration: `${duration}ms`,
          error: error.message,
        });
        throw new ExternalAPIError("Failed to connect to LINE API", "LINE");
      }
    }
  }

  /**
   * Middleware for verifying LINE ID Token in requests
   * @param {Object} headers - Request headers
   * @returns {Promise<string>} LINE User ID
   * @throws {AuthenticationError} If authentication fails
   */
  async authenticateRequest(headers) {
    const authHeader = headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError("Authorization header is missing");
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new AuthenticationError(
        "Authorization header must use Bearer token"
      );
    }

    const idToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!idToken) {
      throw new AuthenticationError("Bearer token is empty");
    }

    try {
      const tokenData = await this.verifyIdToken(idToken);
      return tokenData.lineUserId;
    } catch (error) {
      // Re-throw with additional context
      if (
        error instanceof AuthenticationError ||
        error instanceof ExternalAPIError
      ) {
        throw error;
      }
      throw new AuthenticationError("Token verification failed");
    }
  }

  /**
   * Health check for LINE API connectivity
   * @returns {Promise<boolean>} True if LINE API is accessible
   */
  async healthCheck() {
    try {
      // Use a dummy token to test connectivity (will fail but should get proper error response)
      await this.httpClient.post(
        this.verifyUrl,
        new URLSearchParams({
          id_token: "dummy_token",
          client_id: this.liffId,
        })
      );
      return false; // Should not reach here
    } catch (error) {
      // If we get a 400 response, it means API is accessible
      return error.response?.status === 400;
    }
  }
}

// Export singleton instance
module.exports = new LineAuthService();
