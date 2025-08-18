# CLAUDE.md

## Eres un experto arquitecto de software con excelencia en simplificar, eficiencia y optimizar la aplicación, ademas de mantener actualizado este archivo correctamente documentado.

## 🏗️ Restaurant Management System

**Stack**: Django 5.2 + React 19.1 + Vite + Docker  
**Database**: SQLite | **Auth**: AWS Cognito | **Deploy**: EC2 + Nginx

---

## ⚡ Quick Start

### Development

```bash
./dev.sh    # Backend (Docker) + Frontend (native) - OPTIMAL
```

- **Frontend**: http://localhost:5173 (Vite hot-reload)
- **Backend**: http://localhost:8000 (Django API)
- **Docs**: http://localhost:8000/api/v1/docs/

### Production (EC2)

```bash
./prod.sh   # Complete stack with Nginx + SSL
```

---

## 🔧 Architecture

### DEV Environment (Local)

- **Backend**: Docker container (hot-reload enabled)
- **Frontend**: Native npm/Vite (fastest hot-reload)
- **Database**: SQLite in Docker volume
- **Auth**: AWS Cognito enabled

### PROD Environment (EC2)

- **Backend**: Django in Docker
- **Frontend**: Built static files via Nginx
- **Database**: SQLite persistent volume
- **SSL**: Let's Encrypt via Nginx

---

## 📁 Key Files

### Core Configuration

- `docker-compose.yml` - Unified Docker config
- `.env.dev` / `.env.ec2` - Environment variables
- `dev.sh` / `prod.sh` - Environment scripts

### Backend

- `backend/backend/settings.py` - Django settings
- `backend/api_urls.py` - API routing
- `backend/*/models.py` - Database models
- `backend/*/views.py` - API endpoints

### Frontend

- `frontend/src/App.jsx` - Main routing
- `frontend/src/services/api.js` - API client
- `frontend/src/pages/` - App pages
- `frontend/src/components/` - Reusable components
- `frontend/.env.production` - Production environment variables (create before deploy)

---

## 🚀 Deployment

### Local to Production

```bash
# 1. Test locally
./dev.sh

# 2. Create production environment file (IMPORTANT!)
cat > frontend/.env.production << EOF
VITE_API_BASE_URL=https://www.xn--elfogndedonsoto-zrb.com/api/v1
VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
VITE_AWS_REGION=us-west-2
VITE_FORCE_COGNITO=true
EOF

# 3. Commit and push changes
git add -A && git commit -m "Deploy: Update for production" && git push

# 4. SSH to EC2
ssh -i "ubuntu_fds_key.pem" ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com

# 5. Deploy on EC2
cd /opt/restaurant-web
git pull origin main
./prod.sh
```

### Production URLs

- **Website**: https://www.xn--elfogndedonsoto-zrb.com/
- **API**: https://www.xn--elfogndedonsoto-zrb.com/api/v1/
- **Admin**: https://www.xn--elfogndedonsoto-zrb.com/admin/

---

## 🗄️ Database Operations

### Reset Scripts

```bash
# Development
./reset-database.sh              # Complete wipe
./reset-operational-data.sh      # Keep config, reset orders

# Production
./reset-database.sh --prod       # Complete wipe (backup created)
./reset-operational-data.sh --prod  # Keep config, reset orders
```

---

## 🔗 API Endpoints

**Base URL**: `/api/v1/`

### Core Endpoints

- `/units/`, `/zones/`, `/tables/`, `/containers/` - Restaurant config
- `/groups/`, `/ingredients/`, `/recipes/` - Inventory
- `/orders/`, `/order-items/`, `/payments/` - Operations
- `/dashboard/` - Analytics

### Public Endpoints

- `/health/` - Health check
- `/csrf/` - CSRF token (development)
- `/docs/` - API documentation

---

## 📋 Development Commands

### Manual Backend (if needed)

```bash
docker-compose up -d app         # Start backend only
docker-compose logs app -f       # View logs
docker-compose restart app       # Restart backend
docker-compose down              # Stop all
```

### Manual Frontend (if needed)

```bash
cd frontend
npm run dev                      # Development server
npm run build                    # Production build
npm run lint                     # Linting
npm test                         # Tests
```

---

## 🔐 Environment Variables

### Development (`.env.dev`)

```bash
DEBUG=True
USE_COGNITO_AUTH=True
COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
DATABASE_NAME=restaurant_dev.sqlite3
```

### Production (`.env.ec2`)

```bash
DEBUG=False
USE_COGNITO_AUTH=True
DOMAIN_NAME=xn--elfogndedonsoto-zrb.com
DATABASE_NAME=restaurant_prod.sqlite3
```

---

## 🎯 Order Flow

1. **PENDING** → Customer order created
2. **PREPARING** → Kitchen working
3. **READY** → Ready for service
4. **DELIVERED** → Served to customer
5. **CANCELLED** → Order cancelled

---

## 👥 User Roles

- **admin**: Full system access
- **cashier**: Orders, payments, reports
- **waiter**: Orders and table management
- **kitchen**: Kitchen view only

---

## 🔧 Common Tasks

### Add New API Endpoint

1. Create model in `*/models.py`
2. Create serializer in `*/serializers.py`
3. Create ViewSet in `*/views.py`
4. Register in `api_urls.py`
5. Run migrations

### Add New Frontend Page

1. Create component in `pages/`
2. Add route in `App.jsx`
3. Add navigation in Layout
4. Implement role protection

---

## 🚨 Production Deployment Checklist

### Pre-deployment Verification

```bash
# 1. Verify all migrations are created and committed
python manage.py makemigrations --check

# 2. Test production build locally
./prod.sh

# 3. Verify authentication works
await testApiAuth() // Should show is_authenticated: true
```

### Production Deploy Process

```bash
# 1. SSH to EC2
ssh -i "ubuntu_fds_key.pem" ubuntu@ec2-44-248-47-186.us-west-2.compute.amazonaws.com

# 2. Navigate to project
cd /opt/restaurant-web

# 3. Pull latest changes
git pull origin main

# 4. Build frontend with production env
cd frontend && npm run build && cd ..

# 5. Stop existing containers
docker-compose down

# 6. Deploy with production profile
PROD=1 docker-compose --profile production --env-file .env.ec2 up -d

# 7. Run migrations (CRITICAL - THIS STEP OFTEN FORGOTTEN)
docker exec restaurant-backend python /app/backend/manage.py migrate

# 8. Verify deployment
docker ps
docker logs restaurant-backend --tail=10
docker logs restaurant-nginx --tail=10
```

### Critical: Development Changes Sync Verification

**ALWAYS verify these files are synced from dev to prod:**

```bash
# 1. Database migrations
docker exec restaurant-backend python /app/backend/manage.py showmigrations
# ALL should show [X] - no [ ] pending migrations

# 2. Backend settings configuration
docker exec restaurant-backend python -c "
from django.conf import settings;
print('✅ Settings module:', settings.SETTINGS_MODULE);
print('✅ Cognito middleware:', 'cognito_auth.CognitoAuthenticationMiddleware' in str(settings.MIDDLEWARE))"

# 3. Nginx configuration
docker exec restaurant-nginx grep -n "proxy_set_header Authorization" /etc/nginx/conf.d/default.conf
# Should show multiple lines with Authorization header forwarding

# 4. Frontend environment
docker exec restaurant-nginx cat /var/www/html/index.html | head -5
# Should show production build artifacts

# 5. Container networking
docker network inspect restaurant-web_default
# Should show both restaurant-backend and restaurant-nginx containers
```

### Post-deployment Verification

1. **Test Authentication**: Execute `await testApiAuth()` in browser console
2. **Test API Endpoints**: Try creating orders, accessing dashboard
3. **Check Database**: Verify migrations applied with `showmigrations`
4. **Monitor Logs**: Watch for any 500/403 errors

---

## 🔧 Troubleshooting Common Issues

### 403 Forbidden Errors

**Symptoms**: `testApiAuth()` shows `is_authenticated: false`

**Root Causes & Solutions**:

1. **Expired JWT Token**
   ```bash
   # Solution: Logout and login again in the UI
   localStorage.clear(); sessionStorage.clear(); location.reload();
   ```

2. **Missing CognitoAuthenticationMiddleware**
   ```python
   # Check settings_ec2.py has:
   'backend.cognito_auth.CognitoAuthenticationMiddleware'
   ```

3. **Wrong Django Settings Module**
   ```bash
   # Verify container uses settings_ec2:
   docker exec restaurant-backend python -c "from django.conf import settings; print(settings.SETTINGS_MODULE)"
   # Should show: backend.settings_ec2
   ```

4. **Nginx Not Forwarding Authorization Header**
   ```nginx
   # Verify nginx config has in ALL locations:
   proxy_set_header Authorization $http_authorization;
   ```

### 500 Internal Server Error

**Symptoms**: Creating orders fails with 500 error

**Root Cause**: Missing database migrations

**Solution**:
```bash
# Check migrations status
docker exec restaurant-backend python /app/backend/manage.py showmigrations

# Apply missing migrations
docker exec restaurant-backend python /app/backend/manage.py migrate

# If migration fails, use --fake for problematic ones:
docker exec restaurant-backend python /app/backend/manage.py migrate config 0013 --fake
```

### 502 Bad Gateway

**Symptoms**: Nginx cannot reach backend

**Root Causes & Solutions**:

1. **Containers in different networks**
   ```bash
   # Check network connectivity:
   docker network inspect restaurant-web_default
   # Both nginx and backend should be listed
   ```

2. **Wrong upstream reference**
   ```nginx
   # Nginx config should reference:
   proxy_pass http://restaurant-backend:8000;
   # NOT: http://web:8000 or other names
   ```

### Authentication Debugging Commands

```bash
# Check JWT token format in browser console:
const session = await debugAuth();
console.log("Token:", session.tokens.idToken.toString());

# Test API authentication:
await testApiAuth();

# Check backend authentication status:
docker exec restaurant-backend python -c "
from django.conf import settings; 
print('Cognito enabled:', getattr(settings, 'COGNITO_ENABLED', False));
print('Middleware:', [m for m in settings.MIDDLEWARE if 'cognito' in m.lower()])"
```

---

## 📝 Important Notes

- **Data Safety**: Production data is NEVER deleted during deployment
- **Hot-reload**: Use `./dev.sh` for optimal development experience
- **CSRF**: Automatically handled for development environment
- **Authentication**: AWS Cognito required for all API endpoints
- **Migrations**: ALWAYS run `migrate` after deployment to production
- **Container Networks**: Backend and nginx must be in same Docker network
- **Environment Variables**: Production uses `settings_ec2.py` not `settings.py`

---

## 🐛 Common Issues & Solutions

### XMLHttpRequest cannot load http://localhost:8000

**Problem**: Frontend is trying to connect to localhost instead of production API.

**Solution**: 
1. Ensure `frontend/.env.production` exists with correct `VITE_API_BASE_URL`
2. Rebuild frontend: `cd frontend && npm run build`
3. Redeploy: `./prod.sh`

### CORS Errors

**Problem**: API requests blocked by CORS policy.

**Solution**: 
- Backend automatically configures CORS based on `DOMAIN_NAME` in `.env.ec2`
- Ensure nginx is passing correct headers (already configured)

### 403 Forbidden / Authentication Errors

**Problem**: Getting 403 errors or "Invalid token: Not enough segments" in production.

**Common Causes**:
1. User not logged in with AWS Cognito
2. Token expired or invalid
3. Frontend not sending proper authentication headers

**Solution**:
1. Ensure users are created in AWS Cognito User Pool: `us-west-2_bdCwF60ZI`
2. Verify user groups are assigned (administradores, meseros)
3. Check browser console for authentication errors
4. Clear browser cache and cookies, then login again
5. Verify frontend is using ID Token (not Access Token) for API calls

**Debug Steps** (in browser console):
```javascript
// Check authentication status
await debugAuth()

// Test API authentication
await testApiAuth()
```

Expected results:
- `debugAuth()` should show `hasIdToken: true` or `hasAccessToken: true`
- `testApiAuth()` should show `token_valid_format: true` and `token_segments: 3`

If tokens are missing or malformed, user needs to login again via AWS Cognito.

**Advanced Debugging** (if problem persists):
```javascript
// Get the complete token to test manually
const session = await debugAuth();
console.log("Token completo:", session.tokens.idToken.toString());
```

**Common Issues**:
- **nginx buffer size**: JWT tokens are large (~1000+ chars), nginx needs large buffers
- **Multiple nginx configs**: Disable all .conf files except ssl.conf
- **Proxy headers**: nginx must pass Authorization header to backend
- **Container names**: nginx must proxy to `restaurant-backend:8000`, not `web:8000`
