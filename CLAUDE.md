# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Architecture Overview

This is a full-stack restaurant management system with:
- **Backend**: Django 5.2 + Django REST Framework (port 8000)
- **Frontend**: React 19.1 + Vite (port 5173)
- **Database**: SQLite (local) / PostgreSQL (production)
- **Authentication**: AWS Cognito (configurable)
- **Deployment**: Docker-based enterprise deployment

## Common Development Commands

### Frontend (from `/frontend`)
```bash
npm run dev              # Start development server
npm run build            # Production build
npm run build:prod       # Optimized production build with env vars
npm run test             # Run Jest tests
npm run lint             # ESLint checking
npm run preview          # Preview production build
```

### Backend (from `/backend`)
```bash
make run                 # Start Django server
make migrate             # Apply migrations
make createsuperuser     # Create admin user
make shell               # Django shell

# Direct commands
python manage.py runserver 0.0.0.0:8000
python manage.py migrate
python manage.py makemigrations
```

### Full Development Setup
1. Start backend: `cd backend && make run`
2. Start frontend: `cd frontend && npm run dev`
3. Access app at: `http://localhost:5173`
4. API available at: `http://localhost:8000/api/v1/`

## Key Architecture Components

### Django Apps Structure
- **`config/`**: Base configuration (Tables, Zones, Units, Containers)
- **`inventory/`**: Recipe and ingredient management (Groups, Ingredients, Recipes, RecipeItems)
- **`operation/`**: Restaurant operations (Orders, OrderItems, Payments, ContainerSales)

### API Patterns
- Base URL: `/api/v1/`
- All apps follow DRF ViewSet pattern with full CRUD
- Special endpoints: `/dashboard-financiero/`, `/dashboard-operativo/`, `/kitchen-printer/`
- Excel import endpoints: `/import-units/`, `/import-recipes/`, etc.

### Frontend Structure
- **`pages/`**: Route components organized by feature area
- **`components/`**: Reusable UI components
- **`contexts/`**: React contexts (AuthContext, ToastContext)
- **`services/`**: API integration (api.js, bluetoothPrinter.js)

### Authentication System
- AWS Cognito integration (controlled by `USE_COGNITO_AUTH` env var)
- Development bypass: `DevAuthBypassMiddleware` when Cognito disabled
- Role-based access control with protected routes
- JWT token management in AuthContext

## Database and Models

### Key Model Relationships
- **Recipe → RecipeItem → Ingredient**: Recipe composition
- **Order → OrderItem**: Order details
- **Table → Zone**: Restaurant layout hierarchy
- **Payment**: Links to orders for transaction tracking

### Migration Management
- Always run `make migrate` after model changes
- New migrations in `/backend/operation/migrations/`
- Complex dashboard views use raw SQL migrations

## Deployment

### Production Environment Variables
```bash
NODE_ENV=production
VITE_DISABLE_COGNITO=false
VITE_AWS_COGNITO_USER_POOL_ID=us-west-2_bdCwF60ZI
VITE_AWS_COGNITO_APP_CLIENT_ID=4i9hrd7srgbqbtun09p43ncfn0
VITE_API_BASE_URL=https://www.xn--elfogndedonsoto-zrb.com/api/v1
```

### Deployment Commands
```bash
# GitHub Actions deployment
gh workflow run "Enterprise Production Deployment" -f action=deploy

# Manual deployment
./deploy/enterprise-deploy.sh [ECR_REGISTRY] [ECR_REPOSITORY] deploy
```

## Special Features

### Excel Import System
- Bulk import endpoints for all master data types
- Located in respective app views (config/views.py, inventory/views.py)
- Handle Excel parsing with pandas integration

### Kitchen Operations
- Real-time order updates via Server-Sent Events
- Bluetooth printer integration (`bluetoothPrinter.js`, `bluetoothKitchenPrinter.js`)
- Kitchen display in `/pages/operation/Kitchen.jsx`

### Dashboard System
- Complex SQL views for financial and operational reporting
- Custom dashboard endpoints with aggregated data
- Located in `operation/views_financiero.py` and `operation/views_operativo.py`

## Development Notes

- Vite proxy configuration routes `/api/*` to Django backend
- CORS configured for cross-origin requests during development
- Use `make` commands for common Django operations
- Frontend uses Tailwind CSS for styling
- All API responses follow DRF serializer patterns