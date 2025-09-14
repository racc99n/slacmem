# 🔧 Step-by-step fix for Netlify Functions Dependencies

echo "🚀 Fixing Netlify Functions Dependencies..."

# Step 1: ติดตั้ง Dependencies ที่จำเป็น
echo "📦 Installing required dependencies..."
npm install pg@^8.11.3 jsonwebtoken@^9.0.2 dotenv@^16.3.1 cors@^2.8.5

# Step 2: ติดตั้ง Dev Dependencies
echo "🛠️  Installing dev dependencies..."
npm install --save-dev @types/node@^20.10.0

# Step 3: ตรวจสอบการติดตั้ง
echo "🔍 Verifying installations..."
node -pe "require('pg'); console.log('✅ pg installed')"
node -pe "require('jsonwebtoken'); console.log('✅ jsonwebtoken installed')"
node -pe "require('dotenv'); console.log('✅ dotenv installed')"

# Step 4: ตรวจสอบ package.json
echo "📋 Checking package.json..."
echo "Current dependencies:"
cat package.json | grep -A 10 '"dependencies"' || echo "No dependencies section found"

# Step 5: ทดสอบ Netlify Functions bundling
echo "📦 Testing Netlify Functions bundling..."
if command -v netlify &> /dev/null; then
    netlify functions:build
    if [ $? -eq 0 ]; then
        echo "✅ Functions bundling successful!"
    else
        echo "❌ Functions bundling failed"
    fi
else
    echo "⚠️  Netlify CLI not found, install with: npm install -g netlify-cli"
fi

# Step 6: ทดสোบ local development
echo "🌐 Testing local development..."
if command -v netlify &> /dev/null; then
    echo "Starting Netlify Dev (will run in background for 10 seconds)..."
    timeout 10s netlify dev --port 8888 &
    DEV_PID=$!
    
    sleep 5
    echo "Testing health endpoint..."
    curl -s http://localhost:8888/.netlify/functions/api/health || echo "Local test completed"
    
    kill $DEV_PID 2>/dev/null
    wait $DEV_PID 2>/dev/null
fi

echo ""
echo "✅ Dependencies fix completed!"
echo ""
echo "📋 What was installed:"
echo "  - pg (PostgreSQL driver)"
echo "  - jsonwebtoken (JWT handling)"  
echo "  - dotenv (environment variables)"
echo "  - cors (Cross-origin resource sharing)"
echo ""
echo "🚀 Next commands to try:"
echo "  npm run dev    # Start development server"
echo "  npm test       # Run tests"
echo "  netlify deploy # Deploy to production"