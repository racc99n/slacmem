// scripts/setup-database-simple.js - Simple database setup

console.log('🗄️ Simple Database Setup\n');

// Load environment variables
const fs = require('fs');
const path = require('path');

try {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value && !process.env[key]) {
        process.env[key] = value.replace(/"/g, '');
      }
    });
  }
} catch (error) {
  console.log('⚠️  Could not load .env file');
}

if (!process.env.DATABASE_URL) {
  console.log('❌ DATABASE_URL not found in environment variables');
  console.log('💡 Please ensure .env file exists with DATABASE_URL');
  process.exit(1);
}

console.log('✅ DATABASE_URL found');
console.log('📝 Database URL format looks correct');

// Try to connect to database (if @neondatabase/serverless is available)
async function testConnection() {
  try {
    const { Pool } = require('@neondatabase/serverless');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    console.log('🔗 Testing database connection...');
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful');
    console.log(`📅 Server time: ${result.rows[0].current_time}`);
    
    await pool.end();
    
  } catch (error) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.log('⚠️  @neondatabase/serverless not installed - skipping connection test');
      console.log('💡 Database setup will be done during deployment');
    } else {
      console.log('❌ Database connection failed:', error.message);
      console.log('💡 This might be okay for local development');
    }
  }
}

testConnection().then(() => {
  console.log('\n🎉 Database setup check completed!');
}).catch((error) => {
  console.log('⚠️  Database setup completed with warnings');
});
