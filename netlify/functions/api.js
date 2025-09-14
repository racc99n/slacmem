const { Pool } = require('pg');

// Import validation functions from errors.js (unified location)
const { 
    validatePhoneNumber, 
    validatePIN, 
    validatePhoneNumberOrThrow, 
    validatePINOrThrow, 
    ValidationError 
} = require('../../utils/errors');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// CORS Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-LINE-User-ID',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
};

function createResponse(statusCode, data, headers = {}) {
    return {
        statusCode,
        headers: { ...corsHeaders, ...headers },
        body: JSON.stringify(data)
    };
}

function handleError(error) {
    console.error('API Error:', error);
    
    if (error instanceof ValidationError) {
        return createResponse(error.statusCode || 400, {
            error: {
                message: error.message,
                code: error.code || 'VALIDATION_ERROR'
            }
        });
    }
    
    return createResponse(500, {
        error: {
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            code: 'INTERNAL_ERROR'
        }
    });
}

exports.handler = async (event, context) => {
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(200, {});
    }

    try {
        const path = event.path.replace('/.netlify/functions/api', '');
        const method = event.httpMethod;
        
        console.log(`🚀 API Request: ${method} ${path}`);

        if (path === '/health' && method === 'GET') {
            return createResponse(200, {
                status: 'ok',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development',
                version: '2.0.0',
                database: process.env.DATABASE_URL ? 'configured' : 'not configured'
            });
        }

        if (path === '/user/profile' && method === 'GET') {
            const lineUserId = event.headers['X-LINE-User-ID'] || event.headers['x-line-user-id'];
            
            if (!lineUserId) {
                return createResponse(401, {
                    error: {
                        message: 'LINE User ID is required',
                        code: 'MISSING_LINE_USER_ID'
                    }
                });
            }

            // Mock response for testing (replace with real database call)
            return createResponse(200, {
                username: 'DEMO_USER',
                phone: '0812345678',
                balance: 1000.00,
                level: 'GOLD',
                lastUpdated: new Date().toISOString()
            });
        }

        if (path === '/user/sync' && method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const { lineUserId, primaUsername, primaPhone, primaPin } = body;

            // Validate required fields
            if (!lineUserId || !primaUsername || !primaPhone || !primaPin) {
                return createResponse(400, {
                    error: {
                        message: 'Missing required fields: lineUserId, primaUsername, primaPhone, primaPin',
                        code: 'MISSING_FIELDS'
                    }
                });
            }

            try {
                // Validate input formats
                validatePhoneNumberOrThrow(primaPhone);
                validatePINOrThrow(primaPin);

                // Mock success response
                return createResponse(200, {
                    success: true,
                    message: 'User profile synced successfully',
                    user: {
                        username: primaUsername,
                        phone: primaPhone,
                        balance: 1500.00,
                        level: 'SILVER',
                        lastUpdated: new Date().toISOString()
                    }
                });

            } catch (validationError) {
                return handleError(validationError);
            }
        }

        return createResponse(404, {
            error: {
                message: 'Route not found',
                code: 'NOT_FOUND',
                availableRoutes: ['/health', '/user/profile', '/user/sync']
            }
        });

    } catch (error) {
        return handleError(error);
    }
};
