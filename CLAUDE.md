# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack restaurant management system with Django REST Framework backend and React (Vite) frontend. The system handles configuration (categories, units, zones, tables), inventory management (groups, ingredients, recipes), and operations (orders, payments, kitchen management).

## Development Commands

### Backend (Django)
- **Start development server**: `python manage.py runserver` or `make run` (from backend/)
- **Run migrations**: `python manage.py migrate` or `make migrate`
- **Create migrations**: `python manage.py makemigrations`
- **Create superuser**: `python manage.py createsuperuser` or `make createsuperuser`
- **Django shell**: `make shell`
- **Run tests**: `make test` or `pytest -q`

### Frontend (React + Vite)
- **Start development server**: `npm run dev` (runs on port 5173)
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Preview build**: `npm run preview`

### Docker Development
- **Start services**: `docker-compose up`
- **Start specific service**: `docker-compose up web` or `docker-compose up db`
- **Execute commands in container**: `docker-compose exec web python manage.py [command]`
- **View logs**: `docker-compose logs [service]`

## Architecture

### Backend Structure
- **Django Apps**:
  - `config`: Base configuration models (Category, Unit, Zone, Table)
  - `inventory`: Inventory management (Group, Ingredient, Recipe, RecipeItem)
  - `operation`: Operations (Order, OrderItem, OrderItemIngredient, Payment)

### Frontend Structure
- **React SPA** with React Router for navigation
- **Pages organized by domain**: config/, inventory/, operation/
- **Shared components**: Layout, common components (Button, Modal, Toast, CrudTable)
- **Context**: ToastContext for notifications
- **Styling**: TailwindCSS with Lucide React icons

### Key Business Logic
- **Inventory**: Recipes consume ingredients when orders are created
- **Order Lifecycle**: CREATED → SERVED → PAID
- **Stock Management**: Automatic stock updates when orders are processed
- **Price Calculation**: Dynamic pricing based on ingredient costs and customizations

### Database
- **Development**: SQLite (db.sqlite3)
- **Production**: PostgreSQL via RDS
- **Models use PROTECT**: Prevents deletion of referenced objects

### API Integration
- **Backend API**: Django REST Framework with token authentication
- **Frontend**: Axios for API calls (services/api.js)
- **CORS**: Configured for localhost:5173 development and production domains

## Production Deployment (AWS)

### Architecture
- **EC2 t3.micro**: Backend Django with Docker
- **RDS db.t3.micro**: PostgreSQL database
- **S3**: Static files and frontend hosting
- **CloudFront**: CDN for frontend distribution

### Production Commands
- **Deploy application**: `./deploy/deploy.sh`
- **Deploy frontend only**: `./deploy/frontend-deploy.sh`
- **Backup database**: `./deploy/backup-db.sh`
- **View production logs**: `docker-compose -f docker-compose.prod.yml logs -f`

### Configuration Files
- **Production settings**: `backend/backend/settings_prod.py`
- **Production Docker**: `backend/Dockerfile.prod`
- **Production compose**: `docker-compose.prod.yml`
- **Environment template**: `.env.example`
- **AWS setup guide**: `deploy/aws-setup.md`

### Environment Variables (Production)
Required variables in `.env`:
- `DJANGO_SECRET_KEY`: Django secret key
- `RDS_HOSTNAME`: RDS endpoint
- `RDS_USERNAME`, `RDS_PASSWORD`: Database credentials
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: AWS credentials
- `AWS_S3_BUCKET_NAME`: S3 bucket for static files

## File Patterns
- **Backend models**: Each app has models.py, views.py, serializers.py, admin.py
- **Frontend pages**: Organized by domain with shared components
- **API endpoints**: RESTful design following DRF conventions
- **Deployment scripts**: All in `deploy/` directory