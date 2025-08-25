# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a restaurant management system with a Django REST API backend and React/Vite frontend, designed for AWS Cognito authentication and deployed via Docker.

**Core Structure:**
- `backend/` - Django REST API with apps: `config`, `inventory`, `operation`
- `frontend/` - React SPA with Vite, TailwindCSS, AWS Amplify integration
- `data/` - SQLite databases (dev/prod) and backups
- `nginx/` - Production reverse proxy configuration
- `prod/` - Production deployment scripts

**Key Models:**
- `inventory`: Group, Ingredient, Recipe (menu management)
- `operation`: Order, OrderItem, Payment (POS operations)  
- `config`: Unit, Container, Table, Zone (restaurant configuration)

**Authentication:**
- AWS Cognito integration via AWS Amplify (frontend) and custom DRF auth (backend)
- Toggle via `USE_COGNITO_AUTH` environment variable
- Development mode bypasses authentication

## Development Commands

**Frontend (React/Vite):**
```bash
cd frontend
npm run dev          # Development server (port 5173)
npm run build        # Production build
npm run lint         # ESLint validation
npm run lint:fix     # Auto-fix linting issues
npm test             # Jest tests
npm run test:watch   # Jest in watch mode
```

**Backend (Django):**
```bash
cd backend
make run            # Django runserver (port 8000)  
make migrate        # Apply database migrations
make shell          # Django shell
make test           # Run pytest
# Or directly:
python manage.py runserver 0.0.0.0:8000
python manage.py migrate
```

**Docker Development:**
```bash
# Backend only (frontend runs natively)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d app

# Full production stack  
docker-compose --profile production up -d
```

## Deployment

**Production Deployment:**
```bash
./prod/deploy.sh --full    # Code changes only
./prod/deploy.sh --sync    # Include database sync (destructive)
./prod/deploy.sh --check   # Health check
./prod/deploy.sh --rollback # Rollback deployment
```

The deployment script handles:
- Frontend build optimization
- EC2 deployment via SSH
- Database migrations
- Docker container management
- Health verification

**Database Management:**
- Uses SQLite for both dev (`restaurant_dev.sqlite3`) and prod (`restaurant_prod.sqlite3`)
- Automatic backups during sync operations
- Migration handling with rollback support

## Development Practices

**File Organization:**
- Backend follows Django app structure with separate `models.py`, `views.py`, `serializers.py`
- Frontend uses feature-based organization under `src/pages/` and `src/components/`
- Shared utilities in `src/utils/`, services in `src/services/`

**Key Technologies:**
- Backend: Django 5.2, DRF 3.16, AWS Cognito auth, SQLite
- Frontend: React 19, Vite 7, TailwindCSS, AWS Amplify, Axios
- Infrastructure: Docker, Nginx, AWS EC2

**Testing:**
- Frontend: Jest with React Testing Library (70% coverage threshold)
- Backend: pytest (run via `make test`)

**Performance Notes:**
- Frontend build uses `NODE_OPTIONS='--max-old-space-size=4096'` for memory optimization
- Production Nginx serves static files and proxies API requests
- SSE (Server-Sent Events) used for real-time kitchen updates