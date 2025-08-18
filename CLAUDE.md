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

## 📝 Important Notes

- **Data Safety**: Production data is NEVER deleted during deployment
- **Hot-reload**: Use `./dev.sh` for optimal development experience
- **CSRF**: Automatically handled for development environment
- **Authentication**: AWS Cognito required for all API endpoints
- **Deployment**: Single command deployment with `./prod.sh`

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
