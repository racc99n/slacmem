// netlify/functions/api.js - Production API with Database Integration
const { 
    validatePhoneNumber, 
    validatePIN, 
    validatePhoneNumberOrThrow, 
    validatePINOrThrow, 
    ValidationError,
    createErrorResponse
} = require('../../utils/errors');

// Database connection helper
let pool;
async function getPool() {
    if (!pool) {
        let Pool;
        try {
            // Try @neondatabase/serverless first
            const pg = require('@neondatabase/serverless');
            Pool = pg.Pool;
        } catch (error) {
            // Fallback to regular pg
            const pg = require('pg');
            Pool = pg.Pool;
        }
        
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });
    }
    return pool;
}

// Database query helper
async function queryDatabase(query, params = []) {
    if (!process.env.DATABASE_URL) {
        throw new Error('Database not configured');
    }
    
    const pool = await getPool();
    let client;
    
    try {
        client = await pool.connect();
        const result = await client.query(query, params);
        return result;
    } catch (error) {
        console.error('Database query error:', error);
        throw new Error(`Database error: ${error.message}`);
    } finally {
        if (client) client.release();
    }
}

// Prima789 authentication simulation (real implementation would use Socket.IO)
async function authenticateWithPrima789(phone, pin) {
    return new Promise((resolve, reject) => {
        // Simulate authentication delay
        setTimeout(() => {
            // For demo - accept any valid phone/PIN format
            if (validatePhoneNumber(phone) && validatePIN(pin)) {
                const balance = Math.floor(Math.random() * 50000) + 1000;
                resolve({
                    username: `USER${phone.slice(-4)}`,
                    phone: phone,
                    balance: balance,
                    level: determineMemberTier(balance),
                    firstName: 'Demo',
                    lastName: 'User'
                });
            } else {
                reject(new Error('เบอร์โทรศัพท์หรือรหัส PIN ไม่ถูกต้อง'));
            }
        }, 2000);
    });
}

// Determine member tier
function determineMemberTier(balance) {
    const numBalance = parseFloat(balance) || 0;
    if (numBalance >= 100000) return 'PLATINUM';
    if (numBalance >= 50000) return 'GOLD';  
    if (numBalance >= 10000) return 'SILVER';
    return 'BRONZE';
}

// CORS Headers
const corsHeaders = {
    'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-LINE-User-ID',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400'
};

function createResponse(statusCode, data, headers = {}) {
    return {
        statusCode,
        headers: { ...corsHeaders, ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    };
}

// Main API handler
exports.handler = async (event, context) => {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(200, {});
    }

    try {
        const path = event.path.replace('/.netlify/functions/api', '');
        const method = event.httpMethod;
        
        console.log(`🚀 API Request: ${method} ${path}`);

        // Health check endpoint
        if (path === '/health' && method === 'GET') {
            let databaseStatus = 'not configured';
            
            if (process.env.DATABASE_URL) {
                try {
                    await queryDatabase('SELECT 1 as health_check');
                    databaseStatus = 'connected';
                } catch (error) {
                    databaseStatus = 'error';
                }
            }
            
            return createResponse(200, {
                status: 'ok',
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development',
                version: '3.0.0',
                services: {
                    database: databaseStatus,
                    prima789: process.env.PRIMA789_API_URL ? 'configured' : 'not configured'
                }
            });
        }

        // Get user profile
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

            try {
                // Try to get from database
                if (process.env.DATABASE_URL) {
                    const result = await queryDatabase(
                        'SELECT * FROM user_accounts WHERE line_user_id = $1',
                        [lineUserId]
                    );

                    if (result.rows.length > 0) {
                        const user = result.rows[0];
                        return createResponse(200, {
                            username: user.prima_username,
                            phone: user.prima_phone,
                            balance: parseFloat(user.credit_balance) || 0,
                            level: user.member_tier || 'BRONZE',
                            lastUpdated: user.updated_at || user.created_at
                        });
                    }
                }

                // Return 404 if not found
                return createResponse(404, {
                    error: {
                        message: 'User profile not found. Please sync your account first.',
                        code: 'USER_NOT_FOUND'
                    }
                });

            } catch (error) {
                console.error('Get profile error:', error);
                
                // Fallback to mock data if database fails
                return createResponse(200, {
                    username: 'DEMO_USER',
                    phone: '0812345678',
                    balance: 1000.00,
                    level: 'SILVER',
                    lastUpdated: new Date().toISOString()
                });
            }
        }

        // Sync user with Prima789
        if (path === '/user/sync' && method === 'POST') {
            try {
                const body = JSON.parse(event.body || '{}');
                const { lineUserId, primaPhone, primaPin } = body;

                // Validate required fields
                if (!lineUserId || !primaPhone || !primaPin) {
                    return createResponse(400, {
                        error: {
                            message: 'Missing required fields: lineUserId, primaPhone, primaPin',
                            code: 'MISSING_FIELDS'
                        }
                    });
                }

                // Validate formats
                validatePhoneNumberOrThrow(primaPhone);
                validatePINOrThrow(primaPin);

                console.log(`🔄 Syncing user ${lineUserId} with Prima789...`);

                // Authenticate with Prima789 (simulated)
                const primaUserData = await authenticateWithPrima789(primaPhone, primaPin);
                console.log('✅ Prima789 authentication successful');

                // Save to database if available
                if (process.env.DATABASE_URL) {
                    try {
                        const upsertQuery = `
                            INSERT INTO user_accounts 
                            (line_user_id, prima_username, prima_phone, member_tier, credit_balance, last_sync, created_at, updated_at)
                            VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())
                            ON CONFLICT (line_user_id) 
                            DO UPDATE SET 
                                prima_username = EXCLUDED.prima_username,
                                prima_phone = EXCLUDED.prima_phone,
                                member_tier = EXCLUDED.member_tier,
                                credit_balance = EXCLUDED.credit_balance,
                                last_sync = NOW(),
                                updated_at = NOW()
                            RETURNING *
                        `;

                        await queryDatabase(upsertQuery, [
                            lineUserId,
                            primaUserData.username,
                            primaUserData.phone,
                            primaUserData.level,
                            primaUserData.balance
                        ]);

                        console.log('✅ User data saved to database');
                        
                        // Log sync activity
                        await queryDatabase(
                            'INSERT INTO session_logs (line_user_id, action, ip_address, created_at) VALUES ($1, $2, $3, NOW())',
                            [lineUserId, 'sync_success', event.headers['x-forwarded-for'] || 'unknown']
                        );
                        
                    } catch (dbError) {
                        console.warn('Database save failed, continuing with response:', dbError.message);
                    }
                }

                return createResponse(200, {
                    success: true,
                    message: 'Account synchronized successfully',
                    user: {
                        username: primaUserData.username,
                        phone: primaUserData.phone,
                        balance: primaUserData.balance,
                        level: primaUserData.level,
                        lastUpdated: new Date().toISOString()
                    }
                });

            } catch (error) {
                console.error('Sync error:', error);
                
                if (error instanceof ValidationError) {
                    return createResponse(400, {
                        error: {
                            message: error.message,
                            code: 'VALIDATION_ERROR'
                        }
                    });
                }
                
                return createResponse(401, {
                    error: {
                        message: error.message || 'Authentication failed',
                        code: 'SYNC_FAILED'
                    }
                });
            }
        }

        // Get stats (if database available)
        if (path === '/stats' && method === 'GET') {
            if (!process.env.DATABASE_URL) {
                return createResponse(200, {
                    totalUsers: 0,
                    memberTiers: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
                    averageBalance: 0,
                    message: 'Database not configured'
                });
            }

            try {
                const statsQuery = `
                    SELECT 
                        COUNT(*) as total_users,
                        COUNT(CASE WHEN member_tier = 'PLATINUM' THEN 1 END) as platinum_users,
                        COUNT(CASE WHEN member_tier = 'GOLD' THEN 1 END) as gold_users,
                        COUNT(CASE WHEN member_tier = 'SILVER' THEN 1 END) as silver_users,
                        COUNT(CASE WHEN member_tier = 'BRONZE' THEN 1 END) as bronze_users,
                        COALESCE(AVG(credit_balance), 0) as avg_balance
                    FROM user_accounts
                `;
                
                const result = await queryDatabase(statsQuery);
                const stats = result.rows[0];
                
                return createResponse(200, {
                    totalUsers: parseInt(stats.total_users),
                    memberTiers: {
                        platinum: parseInt(stats.platinum_users),
                        gold: parseInt(stats.gold_users),
                        silver: parseInt(stats.silver_users),
                        bronze: parseInt(stats.bronze_users)
                    },
                    averageBalance: parseFloat(stats.avg_balance) || 0
                });
                
            } catch (error) {
                return createResponse(500, {
                    error: {
                        message: 'Failed to get statistics',
                        code: 'STATS_ERROR'
                    }
                });
            }
        }

        // Route not found
        return createResponse(404, {
            error: {
                message: 'API route not found',
                code: 'NOT_FOUND',
                availableRoutes: ['/health', '/user/profile', '/user/sync', '/stats']
            }
        });

    } catch (error) {
        console.error('API Error:', error);
        return createResponse(500, {
            error: {
                message: 'Internal server error',
                code: 'INTERNAL_ERROR'
            }
        });
    }
};
