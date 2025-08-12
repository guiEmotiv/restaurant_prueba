# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **🎯 ÚLTIMA ACTUALIZACIÓN**: Sistema completamente optimizado con workflow dev→prod automatizado, SSL, y todas las mejores prácticas de seguridad implementadas.

---

## Project Architecture

This is a full-stack restaurant management system with a React frontend and Django REST API backend, designed for deployment on EC2 with AWS Cognito authentication.

### High-Level Structure
- **Frontend**: React SPA built with Vite, using TailwindCSS for styling and AWS Amplify for Cognito integration
- **Backend**: Django REST API with three main apps: `config`, `inventory`, and `operation`
- **Authentication**: AWS Cognito with JWT tokens and role-based permissions (administradores, meseros, cocineros)
- **Database**: SQLite in production for simplicity
- **Deployment**: Docker containers with Nginx reverse proxy on EC2

### Key Applications

#### Backend Apps
- **config**: Core configuration models (Tables, Units, Zones, Containers) and authentication/permissions
- **inventory**: Menu management (Groups, Ingredients, Recipes, stock tracking)
- **operation**: Restaurant operations (Orders, OrderItems, Payments, Kitchen workflow)

#### Frontend Structure
- **pages/**: Main views organized by functionality (Dashboard, config/, inventory/, operation/)
- **components/**: Reusable components with auth/, common/, and feature-specific folders
- **contexts/**: AuthContext for Cognito authentication, ToastContext for notifications
- **services/**: API client and Bluetooth printer integration

## Development Commands

### Backend (Django)
```bash
# From project root
cd backend

# Run development server
make run                    # Starts on 0.0.0.0:8000
python manage.py runserver 0.0.0.0:8000

# Database operations
make migrate               # Apply migrations
python manage.py migrate

# Create admin user
make createsuperuser
python manage.py createsuperuser

# Run tests
make test                  # Run all tests
pytest -q                 # Quick test run
pytest --cov=. --cov-report=term-missing  # With coverage
pytest -m "unit"          # Unit tests only
pytest -m "integration"   # Integration tests only

# Shell access
make shell
python manage.py shell
```

### Frontend (React + Vite)
```bash
# From project root
cd frontend

# Development server
npm run dev                # Starts on port 5173

# Production build
npm run build             # Standard build
npm run build:prod        # Memory-optimized build

# Testing
npm test                  # Run tests once
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report
npm run test:ci           # CI mode (no watch)

# Linting
npm run lint              # ESLint check

# Preview production build
npm run preview
```

### Docker Deployment
```bash
# Development
docker-compose up

# EC2 Production
docker-compose -f docker-compose.ec2.yml up -d

# View logs
docker-compose -f docker-compose.ec2.yml logs web
```

## Authentication & Permissions

The system uses AWS Cognito with three main user groups:
- **administradores**: Full system access
- **meseros**: Table management, orders, payments, history
- **cocineros**: Kitchen view, order status updates

Authentication is implemented via:
- `CognitoAuthenticationMiddleware` in Django
- `AuthContext` in React with AWS Amplify
- JWT tokens with `cognito:groups` claims for role checking

## Key Models & Data Flow

### Core Models
- **Order**: Main order entity linked to Table with status tracking (backend/operation/models.py:11)
- **Recipe**: Menu items with ingredients and pricing (backend/inventory/models.py)
- **Table**: Restaurant table configuration (backend/config/models.py)

### Typical Workflow
1. Waiter creates order from Table view
2. OrderItems added with Recipe selections
3. Kitchen receives order for preparation
4. Payment processed (cash, Yape, split payments)
5. Order marked as paid and closed

## Database Schema

Uses Django ORM with three main model groups:
- **Config models**: Tables, Zones, Units, Containers
- **Inventory models**: Groups, Ingredients, Recipes with stock tracking
- **Operation models**: Orders, OrderItems, Payments with status management

## 🚀 Deployment & Production Architecture

### 🏗️ **Production Infrastructure**
- **Server**: AWS EC2 (44.248.47.186)
- **Domain**: https://www.xn--elfogndedonsoto-zrb.com
- **SSL**: Let's Encrypt certificates (automated)
- **Frontend**: React SPA built with Vite, served by nginx
- **Backend**: Django REST API in Docker container
- **Database**: SQLite for production simplicity
- **Auth**: AWS Cognito with JWT tokens

### 🔄 **Workflow: Development → Production**

#### **Development Environment**
```bash
# 🛠️ Local Development (idéntico a producción)
docker-compose -f docker-compose.dev.yml up -d

# 🔥 Hot-reload development  
docker-compose -f docker-compose.dev.yml --profile dev-hot-reload up -d

# 📍 URLs de desarrollo
- Frontend: http://localhost:3000
- API: http://localhost:3000/api/v1/
- Backend directo: http://localhost:8000
```

#### **Production Deployment**
```bash
# 🚀 Desde servidor EC2 (acceso SSH requerido)
ssh -i ubuntu_fds_key.pem ubuntu@44.248.47.186
cd /opt/restaurant-web
git pull origin main
sudo ./deploy/build-deploy.sh

# ⚡ Deployment opciones
sudo ./deploy/build-deploy.sh --frontend-only  # Solo frontend (2 min)
sudo ./deploy/build-deploy.sh --backend-only   # Solo backend (30 seg)
sudo ./deploy/build-deploy.sh                  # Completo (5 min)
```

### 📋 **Archivos Clave del Sistema**

| **Archivo** | **Entorno** | **Propósito** |
|-------------|------------|---------------|
| `docker-compose.dev.yml` | 🛠️ Desarrollo | HTTP, desarrollo local |
| `docker-compose.ssl.yml` | 🚀 Producción | HTTPS, SSL completo |
| `nginx/conf.d/dev.conf` | 🛠️ Desarrollo | Nginx para desarrollo |
| `nginx/conf.d/ssl.conf` | 🚀 Producción | Nginx con SSL y security headers |
| `.env.dev` | 🛠️ Desarrollo | Auth OFF, DB development |
| `.env.ec2` | 🚀 Producción | Auth ON, DB production |

### 🔐 **Credenciales y Seguridad**

> **⚠️ IMPORTANTE**: Las credenciales NO están en el repositorio por seguridad.

#### **SSH Access**
```bash
# Conexión al servidor
chmod 400 ~/Downloads/ubuntu_fds_key.pem
ssh -i ~/Downloads/ubuntu_fds_key.pem ubuntu@44.248.47.186
```

#### **Environment Variables**
- **Desarrollo**: `.env.dev` (Auth deshabilitado)
- **Producción**: `.env.ec2` (En servidor, NO en repo)
- **Template**: `.env.credentials.example` (Guía para configurar)

### 🎯 **Scripts de Deployment - Optimizados**

| **Script** | **Función** | **Uso** |
|------------|-------------|---------|
| `build-deploy.sh` | 🚀 **PRINCIPAL** - Deploy completo | `sudo ./deploy/build-deploy.sh` |
| `setup-initial.sh` | ⚙️ Configuración inicial | Una vez al inicio |
| `enable-ssl.sh` | 🔒 SSL/HTTPS setup | Cuando se necesite |
| `maintenance.sh` | 🔧 Mantenimiento | `./maintenance.sh --status` |
| `diagnose-connection.sh` | 🩺 Diagnóstico | Troubleshooting |

### 📊 **API Endpoints Optimizados**

#### **Core APIs**
- **Health**: `/api/v1/health/`
- **Tables**: `/api/v1/tables/`
- **Recipes**: `/api/v1/recipes/`
- **Orders**: `/api/v1/orders/`
- **Groups**: `/api/v1/groups/`

#### **Import APIs (Optimizados)**
- **Units**: `/import-units/` (Excel only)
- **Zones**: `/import-zones/` (Excel only)
- **Tables**: `/import-tables/` (Excel only)
- **Containers**: `/import-containers/` (Excel only)
- **Groups**: `/import-groups/` (Excel only)
- **Ingredients**: `/import-ingredients/` (Excel only)
- **Recipes**: `/import-recipes/` (Excel only)

#### **Excel Templates**
- Disponibles en: `/frontend/public/templates/`
- 7 plantillas optimizadas para todas las importaciones
- Solo formato Excel (.xlsx/.xls) permitido

### 🔍 **Troubleshooting & Monitoring**

#### **Estado del Sistema**
```bash
# Verificar servicios
docker-compose -f docker-compose.ssl.yml ps

# Logs en tiempo real
docker-compose -f docker-compose.ssl.yml logs -f

# Diagnóstico completo
./deploy/diagnose-connection.sh
```

#### **Tests de Conectividad**
```bash
# API Health
curl -s https://www.xn--elfogndedonsoto-zrb.com/api/v1/health/

# Frontend
curl -s https://www.xn--elfogndedonsoto-zrb.com/

# Import endpoint example
curl -X POST https://www.xn--elfogndedonsoto-zrb.com/import-units/ \
  -F "file=@plantilla_unidades.xlsx"
```

### ⚡ **Optimizaciones Implementadas**

#### **Performance**
- ✅ **Bundle size**: 394KB (optimizado)
- ✅ **Deploy time**: 5 min vs 10 min original (50% mejora)
- ✅ **Caching**: Foreign key lookups optimizados
- ✅ **Bulk operations**: Import Excel con factory pattern

#### **Code Quality**
- ✅ **4,500+ líneas** eliminadas (código innecesario)
- ✅ **48 scripts obsoletos** removidos (84% reducción)
- ✅ **150+ console.logs** eliminados
- ✅ **Response formats** estandarizados

#### **Security**
- ✅ **SSL/HTTPS** completo con Let's Encrypt
- ✅ **AWS Cognito** integración completa
- ✅ **File validation** para uploads
- ✅ **CORS** configurado apropiadamente

## Common Patterns

### API Integration
- Axios client configured in `frontend/src/services/api.js`
- All API calls include JWT tokens for authentication
- Error handling via ToastContext for user notifications

### Component Structure
- Modal components for CRUD operations (GroupModal, RecipeModal, etc.)
- Protected routes with role-based access control
- Consistent form patterns with validation

### State Management
- React Context for authentication and global state
- Local component state for forms and UI interactions
- API data fetched on component mount with loading states

## Testing Framework

### Backend Tests (pytest)
```bash
# Run all tests with coverage
pytest --cov=. --cov-report=term-missing

# Test categories
pytest -m "unit"           # Unit tests only
pytest -m "integration"    # Integration tests only
pytest -m "slow"           # Long-running tests

# Test fixtures available
# - admin_user, waiter_user, cook_user
# - sample_table, sample_recipe, sample_order
```

### Frontend Tests (Jest + React Testing Library)
```bash
# Run tests
npm test                   # Interactive mode
npm run test:ci           # CI mode with coverage
npm run test:watch        # Watch for changes

# Test structure
# - src/__tests__/setup.js: Global test configuration
# - src/__tests__/components/: Component tests
# - src/__tests__/contexts/: Context tests
# - src/__tests__/services/: Service tests
```

### Coverage Requirements
- Backend: 70% minimum coverage (lines, functions, branches)
- Frontend: 70% minimum coverage
- Critical components require 90%+ coverage

## CI/CD Pipeline

### GitHub Actions Workflows

#### 1. CI/CD Pipeline (`.github/workflows/ci-cd.yml`)
- Triggers: Push to main/develop, PRs to main
- Backend testing with PostgreSQL
- Frontend testing and build
- Security scanning (Bandit, Safety, npm audit)
- Automated deployment to dev/prod

#### 2. PR Checks (`.github/workflows/pr-checks.yml`)
- Fast feedback for pull requests
- Quick unit tests and linting
- Code quality checks
- Performance analysis

#### 3. Quality Gate (`.github/workflows/quality-gate.yml`)
- Comprehensive testing suite
- Integration tests
- Performance benchmarks
- Security audits
- Nightly quality checks

#### 4. Deployment (`.github/workflows/deploy.yml`)
- Production deployment to EC2
- Health checks and rollback capability
- Blue-green deployment strategy
- Database migrations

### Deployment Process
1. Code push triggers CI pipeline
2. Tests run in parallel (backend + frontend)
3. Security scans validate dependencies
4. Build artifacts created and tested
5. Deployment to staging/production
6. Health checks verify deployment
7. Rollback available if issues detected

### Environment Configuration
- **Development**: Local Docker with hot reload
- **Staging**: Automated deployment from develop branch
- **Production**: Manual/automated deployment from main branch
- **Monitoring**: Health checks, logging, error tracking

### Required Secrets (GitHub)
- `EC2_SSH_KEY`: SSH private key for EC2 access
- `EC2_HOST`: Production server hostname
- `EC2_USER`: SSH username (typically ubuntu)

### Quality Gates
- All tests must pass (70%+ coverage)
- No high-severity security vulnerabilities
- Linting and code style checks pass
- Build size within acceptable limits
- API health checks successful