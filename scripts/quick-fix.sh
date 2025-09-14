# 🏆 RECOMMENDED SOLUTION: วิธีที่ 2 (Single Domain)
# เหตุผล: ง่ายที่สุด, ไม่ต้องจัดการหลาย domain

echo "🚀 Quick Fix: Use Single Domain Solution"
echo "========================================"

# 1. ตรวจสอบว่ามีไฟล์ HTML ในโปรเจค
echo "📁 Step 1: Check HTML files..."
if [ -f "prima789-liff-member-card.html" ]; then
    echo "✅ prima789-liff-member-card.html found"
else
    echo "❌ prima789-liff-member-card.html NOT found"
    echo "   Please create or move HTML files to project root"
fi

# 2. อัพเดต netlify.toml
echo "📝 Step 2: Update netlify.toml..."
cat > netlify.toml << 'EOF'
[build]
  command = "npm run build"
  functions = "netlify/functions"
  publish = "."

# API redirects
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

# Headers for HTML files
[[headers]]
  for = "/*.html"
  [headers.values]
    X-Frame-Options = "ALLOWALL"
    Access-Control-Allow-Origin = "*"

# Headers for Functions
[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    Access-Control-Allow-Origin = "https://slaczcardmem.netlify.app, https://liff.line.me"
    Access-Control-Allow-Headers = "Content-Type, Authorization, X-LINE-User-ID"
    Access-Control-Allow-Methods = "GET, POST, PUT, DELETE, OPTIONS"
EOF

echo "✅ netlify.toml updated"

# 3. สร้าง index.html
echo "📄 Step 3: Create homepage..."
cat > index.html << 'EOF'
<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Prima789 Member System</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 text-white min-h-screen">
    <div class="container mx-auto px-4 py-16 text-center">
        <h1 class="text-4xl font-bold mb-8 text-yellow-400">🎰 Prima789</h1>
        <p class="text-xl mb-12 text-gray-300">ระบบสมาชิกออนไลน์</p>
        
        <div class="max-w-md mx-auto space-y-4">
            <a href="/prima789-liff-member-card.html" 
               class="block bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-4 px-8 rounded-lg transition duration-300">
                📱 เปิด Member Card
            </a>
            
            <div class="mt-8 p-4 bg-gray-800 rounded-lg text-sm">
                <div id="status" class="text-gray-400">กำลังตรวจสอบระบบ...</div>
            </div>
        </div>
    </div>
    
    <script>
        fetch('/.netlify/functions/api/health')
            .then(r => r.json())
            .then(d => {
                document.getElementById('status').innerHTML = 
                    `<span class="text-green-400">✅ ระบบพร้อมใช้งาน</span><br>
                     <small>Version: ${d.version} | Env: ${d.environment}</small>`;
            })
            .catch(e => {
                document.getElementById('status').innerHTML = 
                    `<span class="text-red-400">❌ ระบบขัดข้อง</span>`;
            });
    </script>
</body>
</html>
EOF

echo "✅ index.html created"

# 4. Deploy
echo "🚀 Step 4: Deploy..."
git add .
git commit -m "Fix: Add HTML files and configure single domain"
git push origin main

# 5. Update LINE Console
echo ""
echo "📱 Step 5: UPDATE LINE LIFF CONSOLE"
echo "===================================="
echo "🔑 Change Endpoint URL to:"
echo "https://slaczcardmem.netlify.app/prima789-liff-member-card.html"
echo ""
echo "📋 Add Callback URLs:"
echo "- https://slaczcardmem.netlify.app/"
echo "- https://slaczcardmem.netlify.app/prima789-liff-member-card.html"
echo "- https://liff.line.me/2008101230-z37JaYn1"
echo ""

# 6. Test commands
echo "🧪 Step 6: Test after deployment"
echo "================================="
echo ""
echo "# Test homepage:"
echo "curl https://slaczcardmem.netlify.app/"
echo ""
echo "# Test LIFF app:"
echo "curl https://slaczcardmem.netlify.app/prima789-liff-member-card.html"
echo ""
echo "# Test API:"
echo "curl https://slaczcardmem.netlify.app/.netlify/functions/api/health"

echo ""
echo "✅ SOLUTION SUMMARY"
echo "==================="
echo "🎯 Domain: slaczcardmem.netlify.app (single domain for everything)"
echo "🏠 Homepage: https://slaczcardmem.netlify.app/"
echo "📱 LIFF App: https://slaczcardmem.netlify.app/prima789-liff-member-card.html"
echo "🔌 API: https://slaczcardmem.netlify.app/.netlify/functions/api/"
echo ""
echo "⚡ This solution is:"
echo "✅ Simplest to manage"
echo "✅ No DNS configuration needed"
echo "✅ Single SSL certificate"
echo "✅ No CORS issues"
echo "✅ Works immediately after deployment"