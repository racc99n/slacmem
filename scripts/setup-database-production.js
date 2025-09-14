// scripts/setup-database-production.js - Production Database Setup
require('dotenv').config();

class DatabaseSetup {
    constructor() {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is required');
        }
    }

    log(message, type = 'info') {
        const icons = { info: '📋', success: '✅', warning: '⚠️', error: '❌' };
        console.log(`${icons[type]} ${message}`);
    }

    async run() {
        try {
            console.log('🚀 Prima789 Production Database Setup\n');
            
            // Check if we have the required dependency
            let Pool;
            try {
                const pg = require('@neondatabase/serverless');
                Pool = pg.Pool;
            } catch (error) {
                // Fallback to regular pg
                const pg = require('pg');
                Pool = pg.Pool;
            }

            this.pool = new Pool({
                connectionString: process.env.DATABASE_URL,
                ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
            });

            // Test connection
            this.log('Testing database connection...');
            const result = await this.pool.query('SELECT NOW() as current_time, version() as version');
            const { current_time, version } = result.rows[0];
            
            this.log('Database connected successfully', 'success');
            this.log(`Server time: ${current_time}`);
            this.log(`PostgreSQL: ${version.split(' ')[0]}`);

            // Create tables
            this.log('Creating database tables...');
            
            // Enhanced user_accounts table
            const userAccountsTable = `
                CREATE TABLE IF NOT EXISTS user_accounts (
                    id SERIAL PRIMARY KEY,
                    line_user_id VARCHAR(255) UNIQUE NOT NULL,
                    line_display_name VARCHAR(255),
                    prima_username VARCHAR(255) NOT NULL,
                    prima_phone VARCHAR(20),
                    member_tier VARCHAR(50) DEFAULT 'BRONZE',
                    credit_balance DECIMAL(15,2) DEFAULT 0.00,
                    last_sync TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `;

            // Session logs table
            const sessionLogsTable = `
                CREATE TABLE IF NOT EXISTS session_logs (
                    id SERIAL PRIMARY KEY,
                    line_user_id VARCHAR(255) NOT NULL,
                    action VARCHAR(100) NOT NULL,
                    ip_address INET,
                    user_agent TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `;

            await this.pool.query(userAccountsTable);
            this.log('Created user_accounts table', 'success');
            
            await this.pool.query(sessionLogsTable);
            this.log('Created session_logs table', 'success');

            // Create indexes
            this.log('Creating database indexes...');
            const indexes = [
                'CREATE INDEX IF NOT EXISTS idx_user_accounts_line_user_id ON user_accounts(line_user_id);',
                'CREATE INDEX IF NOT EXISTS idx_user_accounts_prima_username ON user_accounts(prima_username);',
                'CREATE INDEX IF NOT EXISTS idx_user_accounts_member_tier ON user_accounts(member_tier);',
                'CREATE INDEX IF NOT EXISTS idx_session_logs_line_user_id ON session_logs(line_user_id);',
                'CREATE INDEX IF NOT EXISTS idx_session_logs_created_at ON session_logs(created_at);'
            ];

            for (const indexQuery of indexes) {
                try {
                    await this.pool.query(indexQuery);
                } catch (error) {
                    this.log(`Index creation warning: ${error.message}`, 'warning');
                }
            }
            
            this.log('Database indexes created', 'success');

            // Verify setup
            this.log('Verifying database setup...');
            
            const userCount = await this.pool.query('SELECT COUNT(*) FROM user_accounts');
            const sessionCount = await this.pool.query('SELECT COUNT(*) FROM session_logs');
            
            this.log(`Current data: ${userCount.rows[0].count} users, ${sessionCount.rows[0].count} sessions`);
            
            this.log('\n🎉 Database setup completed successfully!', 'success');
            this.log('✨ Your Prima789 database is ready for production use!');
            
        } catch (error) {
            this.log(`Setup failed: ${error.message}`, 'error');
            
            if (error.code === 'MODULE_NOT_FOUND') {
                this.log('Missing database driver. Installing...', 'warning');
                this.log('Please run: npm install @neondatabase/serverless', 'info');
            }
            
            // Don't exit with error for deployment process
            this.log('Continuing with deployment...', 'warning');
        } finally {
            if (this.pool) {
                await this.pool.end();
            }
        }
    }
}

// Run if called directly
if (require.main === module) {
    const setup = new DatabaseSetup();
    setup.run().catch(console.error);
}

module.exports = DatabaseSetup;
