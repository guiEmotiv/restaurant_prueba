# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a full-stack restaurant management system with:
- **Backend**: Django REST Framework (Python 3.12, Django 5.2, DRF 3.16)
- **Frontend**: React 19 + Vite + TailwindCSS + Lucide icons
- **Authentication**: AWS Cognito integration
- **Database**: SQLite (development), PostgreSQL 17 (production)
- **Deployment**: Docker containers on EC2 with Nginx

### Core Apps Structure
- `config/`: Restaurant configuration (units, zones, tables, containers)
- `inventory/`: Inventory management (groups, ingredients, recipes)
- `operation/`: Order management and payment processing
- `frontend/src/pages/`: React pages organized by domain (config, inventory, operation)

## Development Commands

### Backend (Django)
```bash
# Setup and run backend
cd backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000

# Using Makefile shortcuts
make run          # Start development server
make migrate      # Apply migrations
make test         # Run pytest
make shell        # Django shell
```

### Frontend (React)
```bash
cd frontend
npm install
npm run dev       # Development server on port 5173
npm run build     # Production build
npm run build:prod  # Production build with memory optimization
npm run lint      # ESLint
npm run preview   # Preview production build
```

### Production Deployment (EC2)
```bash
# After git push, run on EC2 server:
cd /opt/restaurant-web
sudo git pull origin main
sudo ./deploy/build-deploy.sh              # Full deployment
sudo ./deploy/build-deploy.sh --frontend-only  # Frontend only
```

## Key Technical Details

### Authentication Flow
- Uses AWS Cognito for authentication with role-based access
- Backend middleware: `backend.cognito_auth.CognitoAuthenticationMiddleware`
- Frontend contexts: `AuthContext` and role-based route protection
- Roles determine dashboard access (operational vs financial)

### API Architecture
- REST API at `/api/v1/` with no pagination (pagination_class = None)
- Debug endpoints: `/api/v1/debug/database/` and `/api/v1/debug/api/`
- Health check: `/api/v1/health/`
- CORS configured for localhost:5173 and production domain

### Data Models Hierarchy
- **Config**: Unit → Zone → Table, Container (standalone)
- **Inventory**: Group → Recipe → RecipeIngredient → Ingredient
- **Operation**: Order → OrderItem → Recipe, Payment (linked to Order)

### Frontend State Management
- React Context for auth and toasts
- Axios for API calls with base configuration in `services/api.js`
- React Router for routing with role protection

### Build Optimization
- Frontend uses cache busting with unique filenames
- Memory optimization: `NODE_OPTIONS='--max-old-space-size=4096'` for builds
- Version indicator in UI footer for deployment verification

## Management Commands
- `python manage.py check_database`: Verify database state
- `python manage.py clean_database --confirm`: Clean all data
- `python manage.py populate_production_data`: Populate with sample data
- `python manage.py ensure_database_ready`: Initialize database
- `./scripts/setup_database.sh`: Complete database setup script (EC2) - cleans and populates database

## Database Population Rules
- **All recipes MUST have ingredients**: Every recipe requires at least one RecipeItem linking to an Ingredient
- **All recipes MUST have a container**: Every recipe requires a Container assignment for packaging/serving
- Recipe creation will fail validation without both ingredients and container assignment

## Environment Variables
- Backend uses `.env` file with DATABASE_NAME, COGNITO configs, ALLOWED_HOSTS
- Frontend uses Vite env vars: VITE_API_URL, VITE_AWS_* for Cognito
- Production uses docker-compose.ec2.yml with environment-specific settings

## Common Issues & Fixes
- **Empty API responses**: Likely pagination enabled - ensure `pagination_class = None` in ViewSets
- **Build memory errors**: Use `build:prod` script with reduced memory allocation
- **CORS issues**: Check ALLOWED_HOSTS in Django and CORS_ALLOWED_ORIGINS
- **Cache issues**: Frontend implements cache busting, check version indicator in UI