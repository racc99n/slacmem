const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

// Import validation functions
const { 
    isValidPhoneNumber, 
    isValidPIN, 
    validatePhoneNumberOrThrow, 
    validatePINOrThrow, 
    ValidationError 
} = require('../../utils/validation');

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// CORS Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
        ? 'https://prima168.online,https://liff.line.me,https://slaczcardmem.netlify.app'
        : '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-LINE-ChannelId, X-LINE-ChannelSecret, X-LINE-User-ID',
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
        return createResponse(error.status, {
            error: {
                message: error.message,
                code: error.code
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
        
        const origin = event.headers.origin || event.headers.Origin;
        const allowedOrigins = [
            'https://prima168.online',
            'https://liff.line.me',
            'https://slaczcardmem.netlify.app',
            'http://localhost:8888'
        ];

        let responseHeaders = { ...corsHeaders };
        if (allowedOrigins.includes(origin)) {
            responseHeaders['Access-Control-Allow-Origin'] = origin;
        }

        if (path === '/health' && method === 'GET') {
            return {
                statusCode: 200,
                headers: responseHeaders,
                body: JSON.stringify({
                    status: 'ok',
                    timestamp: new Date().toISOString(),
                    environment: process.env.NODE_ENV || 'development',
                    version: '2.0.0'
                })
            };
        }

        if (path === '/status' && method === 'GET') {
            const client = await pool.connect();
            try {
                const result = await client.query('SELECT NOW() as timestamp');
                client.release();
                
                return {
                    statusCode: 200,
                    headers: responseHeaders,
                    body: JSON.stringify({
                        status: 'ok',
                        database: 'connected',
                        timestamp: result.rows[0].timestamp,
                        environment: process.env.NODE_ENV || 'development'
                    })
                };
            } catch (dbError) {
                client.release();
                return {
                    statusCode: 503,
                    headers: responseHeaders,
                    body: JSON.stringify({
                        status: 'error',
                        database: 'disconnected',
                        error: dbError.message,
                        timestamp: new Date().toISOString()
                    })
                };
            }
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

            const client = await pool.connect();
            try {
                const result = await client.query(
                    'SELECT * FROM user_mappings WHERE line_user_id = $1',
                    [lineUserId]
                );
                
                client.release();

                if (result.rows.length === 0) {
                    return createResponse(404, {
                        error: {
                            message: 'User profile not found',
                            code: 'USER_NOT_FOUND'
                        }
                    });
                }

                const user = result.rows[0];
                return createResponse(200, {
                    username: user.prima_username,
                    phone: user.prima_phone,
                    balance: user.prima_balance,
                    level: user.member_level || 'BRONZE',
                    lastUpdated: user.last_sync
                });

            } catch (dbError) {
                client.release();
                throw dbError;
            }
        }

        if (path === '/user/sync' && method === 'POST') {
            const body = JSON.parse(event.body || '{}');
            const { lineUserId, primaUsername, primaPhone, primaPin } = body;

            if (!lineUserId || !primaUsername || !primaPhone || !primaPin) {
                return createResponse(400, {
                    error: {
                        message: 'Missing required fields: lineUserId, primaUsername, primaPhone, primaPin',
                        code: 'MISSING_FIELDS'
                    }
                });
            }

            try {
                validatePhoneNumberOrThrow(primaPhone);
                validatePINOrThrow(primaPin);
            } catch (validationError) {
                return handleError(validationError);
            }

            const client = await pool.connect();
            try {
                const insertResult = await client.query(`
                    INSERT INTO user_mappings 
                    (line_user_id, prima_username, prima_phone, prima_balance, member_level, last_sync, created_at)
                    VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
                    ON CONFLICT (line_user_id) 
                    DO UPDATE SET 
                        prima_username = EXCLUDED.prima_username,
                        prima_phone = EXCLUDED.prima_phone,
                        prima_balance = EXCLUDED.prima_balance,
                        member_level = EXCLUDED.member_level,
                        last_sync = NOW()
                    RETURNING *
                `, [lineUserId, primaUsername, primaPhone, 0, 'BRONZE']);

                client.release();

                const user = insertResult.rows[0];
                return createResponse(200, {
                    success: true,
                    message: 'User profile synced successfully',
                    user: {
                        username: user.prima_username,
                        phone: user.prima_phone,
                        balance: user.prima_balance,
                        level: user.member_level,
                        lastUpdated: user.last_sync
                    }
                });

            } catch (dbError) {
                client.release();
                throw dbError;
            }
        }

        return createResponse(404, {
            error: {
                message: 'Route not found',
                code: 'NOT_FOUND',
                availableRoutes: ['/health', '/status', '/user/profile', '/user/sync']
            }
        });

    } catch (error) {
        return handleError(error);
    }
};
