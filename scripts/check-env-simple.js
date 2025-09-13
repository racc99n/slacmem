// scripts/check-env-simple.js - Simple environment check without external dependencies

console.log('🔧 Environment Variables Check\n');

// Load .env file manually (simple version)
const fs = require('fs');
const path = require('path');

// Try to load .env file
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
    console.log('✅ .env file loaded');
  } else {
    console.log('⚠️  .env file not found');
  }
} catch (error) {
  console.log('⚠️  Could not load .env file:', error.message);
}

// Check required variables
const required = ['DATABASE_URL', 'LIFF_ID'];
const optional = ['JWT_SECRET', 'NODE_ENV', 'PRIMA789_API_URL'];

console.log('📋 Required Variables:');
let missingRequired = 0;
required.forEach(env => {
  if (process.env[env]) {
    const preview = process.env[env].length > 30 ? process.env[env].substring(0, 30) + '...' : process.env[env];
    console.log(`✅ ${env}: ${preview}`);
  } else {
    console.log(`❌ ${env}: Missing`);
    missingRequired++;
  }
});

console.log('\n⚙️ Optional Variables:');
optional.forEach(env => {
  if (process.env[env]) {
    console.log(`✅ ${env}: ${process.env[env]}`);
  } else {
    console.log(`⚠️  ${env}: Not set`);
  }
});

console.log('\n📊 Summary:');
console.log(`Node.js: ${process.version}`);
console.log(`Platform: ${process.platform}`);

if (missingRequired === 0) {
  console.log('🎉 All required environment variables are set!');
  process.exit(0);
} else {
  console.log(`❌ ${missingRequired} required variable(s) missing`);
  process.exit(1);
}
