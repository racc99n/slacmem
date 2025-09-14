// scripts/test-database.js - Test database connection
require('dotenv').config();

async function testDatabase() {
    if (!process.env.DATABASE_URL) {
        console.log('⚠️  DATABASE_URL not set, skipping database test');
        return;
    }
    
    try {
        let Pool;
        try {
            const pg = require('@neondatabase/serverless');
            Pool = pg.Pool;
        } catch (error) {
            const pg = require('pg');
            Pool = pg.Pool;
        }
        
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        
        console.log('🔗 Testing database connection...');
        const result = await pool.query('SELECT NOW() as current_time');
        console.log('✅ Database connection successful');
        console.log(`📅 Server time: ${result.rows[0].current_time}`);
        
        await pool.end();
        
    } catch (error) {
        console.log('❌ Database connection failed:', error.message);
        if (error.code === 'MODULE_NOT_FOUND') {
            console.log('💡 Install database driver: npm install @neondatabase/serverless');
        }
        process.exit(1);
    }
}

if (require.main === module) {
    testDatabase();
}
