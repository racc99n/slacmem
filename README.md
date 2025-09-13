# Prima789 LIFF Member Card

🎯 **Production-ready LINE LIFF application for Prima789 member card system**

## 📋 Overview

This application provides a seamless integration between LINE and Prima789, allowing users to:

- View their Prima789 member card directly in LINE
- Check credit balance and member tier
- Secure authentication through LINE ID Token
- Real-time data synchronization

## 🏗️ Architecture

```
LINE LIFF App → Netlify Functions → Neon Database
     ↓              ↓                    ↓
LINE User ID → Prima789 API → User Mappings
```

## 🚀 Features

### ✅ Security

- LINE ID Token verification
- Rate limiting (100 requests per 15 minutes)
- Input validation and sanitization
- CORS protection
- SQL injection prevention

### ✅ Performance

- Connection pooling
- Request/response logging
- Error tracking
- Health monitoring
- Graceful error handling

### ✅ User Experience

- Responsive design
- Loading states
- Error recovery
- Offline detection
- Form validation

## 🛠️ Tech Stack

- **Frontend**: HTML5, TailwindCSS, Vanilla JavaScript
- **Backend**: Node.js, Netlify Functions
- **Database**: Neon PostgreSQL
- **Authentication**: LINE LIFF SDK
- **Integration**: Prima789 Socket.IO API

## 📦 Installation

### Prerequisites

- Node.js 18+
- LINE Developers Account
- Neon Database Account
- Netlify Account

### 1. Clone Repository

```bash
git clone https://github.com/racc99n/slacmem.git
cd slacmem
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Create `.env` file:

```env
# Database
DATABASE_URL="your_neon_database_url"

# LINE Configuration
LIFF_ID="your_liff_id"

# Optional: Advanced Configuration
JWT_SECRET="your_jwt_secret"
API_RATE_LIMIT="100"
PRIMA789_TIMEOUT="20000"
NODE_ENV="production"
LOG_LEVEL="info"
ALLOWED_ORIGINS="https://liff.line.me"
```

### 4. Database Setup

```bash
npm run setup-db
```

### 5. Local Development

```bash
npm run dev
```

## 🔧 Configuration

### LINE LIFF Setup

1. Create LIFF app in LINE Developers Console
2. Set endpoint URL: `https://your-netlify-app.netlify.app/prima789-liff-member-card.html`
3. Configure scopes: `profile`, `openid`
4. Copy LIFF ID to environment variables

### Neon Database Setup

1. Create new Neon project
2. Copy connection string to `DATABASE_URL`
3. Run database setup script

### Netlify Deployment

1. Connect GitHub repository
2. Set environment variables in Netlify dashboard
3. Deploy automatically on push

## 🗂️ Project Structure

```
├── config/
│   └── config.js              # Configuration management
├── netlify/
│   └── functions/
│       └── api.js             # Main API handler
├── public/
│   └── prima789-liff-member-card.html  # Frontend
├── scripts/
│   └── setup-database.js      # Database setup
├── services/
│   ├── databaseService.js     # Database operations
│   ├── lineAuthService.js     # LINE authentication
│   └── prima789Service.js     # Prima789 integration
├── utils/
│   ├── errors.js              # Error handling
│   ├── logger.js              # Logging utility
│   └── rateLimiter.js         # Rate limiting
├── .env                       # Environment variables
├── .gitignore                 # Git ignore rules
├── netlify.toml               # Netlify configuration
├── package.json               # Dependencies
└── README.md                  # Documentation
```

## 📡 API Endpoints

### GET `/api/status`

Check user sync status

- **Headers**: `Authorization: Bearer {LINE_ID_TOKEN}`
- **Response**: User sync status and member data

### POST `/api/sync`

Sync LINE account with Prima789

- **Headers**: `Authorization: Bearer {LINE_ID_TOKEN}`
- **Body**: `{ "username": "phone", "password": "pin" }`
- **Response**: Sync result and member data

### GET `/api/health`

Service health check

- **Response**: Health status of all services

## 🗄️ Database Schema

### `user_mappings`

```sql
CREATE TABLE user_mappings (
    id SERIAL PRIMARY KEY,
    line_user_id VARCHAR(255) UNIQUE NOT NULL,
    prima_username VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `session_logs`

```sql
CREATE TABLE session_logs (
    id SERIAL PRIMARY KEY,
    line_user_id VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔒 Security Features

### Authentication

- LINE ID Token verification
- Bearer token validation
- Automatic token refresh

### Rate Limiting

- 100 requests per 15 minutes per IP
- Automatic cleanup of old entries
- Graceful degradation

### Input Validation

- Phone number format validation
- PIN format validation (4 digits)
- SQL injection prevention
- XSS protection

### Headers Security

- CSP (Content Security Policy)
- HSTS (HTTP Strict Transport Security)
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff

## 📊 Monitoring & Logging

### Structured Logging

```javascript
logger.info("User authenticated", {
  userId: "user***",
  action: "login",
  timestamp: "2024-01-01T00:00:00Z",
});
```

### Health Checks

- Database connectivity
- LINE API status
- Prima789 API status
- Overall system health

### Error Tracking

- Comprehensive error logging
- User-friendly error messages
- Automatic retry mechanisms
- Graceful fallbacks

## 🚀 Deployment

### Automatic Deployment

Push to `main` branch triggers automatic deployment to Netlify.

### Manual Deployment

```bash
# Build and deploy
npm run build
netlify deploy --prod
```

### Environment Variables (Netlify)

Set these in Netlify Dashboard → Site Settings → Environment Variables:

- `DATABASE_URL`
- `LIFF_ID`
- `NODE_ENV=production`
- `LOG_LEVEL=info`

## 🧪 Testing

### Manual Testing Checklist

- [ ] LIFF initialization
- [ ] LINE authentication
- [ ] Token verification
- [ ] Prima789 login
- [ ] Data synchronization
- [ ] Error handling
- [ ] Rate limiting
- [ ] Health checks

### Load Testing

```bash
# Test rate limiting
for i in {1..150}; do curl https://your-app.netlify.app/api/health; done
```

## 🐛 Troubleshooting

### Common Issues

#### "Invalid or expired token"

- **Cause**: LINE ID Token verification failed
- **Solution**: Check LIFF_ID configuration, ensure user is properly logged in

#### "Rate limit exceeded"

- **Cause**: Too many requests from same IP
- **Solution**: Wait 15 minutes or implement user-specific rate limiting

#### "Database connection failed"

- **Cause**: Invalid DATABASE_URL or network issues
- **Solution**: Verify connection string, check Neon database status

#### "Prima789 connection timeout"

- **Cause**: Prima789 server issues or network problems
- **Solution**: Implement retry mechanism, check Prima789 server status

### Debug Mode

Set `LOG_LEVEL=debug` for detailed logging:

```env
LOG_LEVEL=debug
```

## 📈 Performance Optimization

### Database

- Connection pooling (max 10 connections)
- Query optimization
- Index on `line_user_id`
- Automatic cleanup of old logs

### API

- Response compression
- Caching headers
- Rate limiting
- Request/response logging

### Frontend

- Lazy loading
- Image optimization
- CSS/JS minification
- Progressive enhancement

## 🔄 Maintenance

### Database Cleanup

```sql
-- Clean old session logs (older than 30 days)
DELETE FROM session_logs
WHERE created_at < NOW() - INTERVAL '30 days';
```

### Log Rotation

Logs are automatically managed by Netlify Functions. For custom log retention:

- Implement log archiving
- Set up log analysis tools
- Monitor log sizes

### Regular Health Checks

- Monitor health endpoint: `/api/health`
- Check database performance
- Verify Prima789 connectivity
- Review error rates

## 🆘 Support

### Contact Information

- **Developer**: Your Name
- **Email**: your.email@example.com
- **GitHub**: [Repository Issues](https://github.com/racc99n/slacmem/issues)

### Emergency Contacts

- **Database Issues**: Neon Support
- **LIFF Issues**: LINE Developers Support
- **Hosting Issues**: Netlify Support

## 📜 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- LINE Corporation for LIFF SDK
- Neon for database services
- Netlify for hosting platform
- Prima789 for API integration

---

**📝 Last Updated**: January 2024  
**🔄 Version**: 1.0.0  
**💻 Status**: Production Ready
