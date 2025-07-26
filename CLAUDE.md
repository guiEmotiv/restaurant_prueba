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
- **Clean database**: `./clean_db.sh` or `python manage.py clean_database --confirm`
- **Populate test data**: `python manage.py populate_test_data`
- **EC2 commands**: Use `python3` instead of `python` on Ubuntu servers

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
- **Production**: SQLite (simple deployment) or PostgreSQL (advanced)
- **Models use PROTECT**: Prevents deletion of referenced objects

### API Integration
- **Backend API**: Django REST Framework with token authentication
- **Frontend**: Axios for API calls (services/api.js)
- **CORS**: Configured for localhost:5173 development and production domains

## Production Deployment (EC2 + SQLite + Docker)

### Architecture
- **EC2 t3.micro**: Ubuntu server with Docker
- **SQLite**: Simple, reliable database
- **Local Storage**: Static files and media
- **Single Container**: Streamlined deployment

### Production Commands
- **Setup new server**: `./deploy/ec2-setup.sh`
- **Deploy application**: `./deploy/ec2-deploy.sh`
- **Check status**: `./deploy/ec2-deploy.sh status`
- **View logs**: `./deploy/ec2-deploy.sh logs`
- **Create backup**: `./deploy/ec2-deploy.sh backup`
- **Restart app**: `./deploy/ec2-deploy.sh restart`
- **Clean database**: `./deploy/clean-db.sh`

### Configuration Files
- **EC2 settings**: `backend/backend/settings_ec2.py`
- **EC2 Docker**: `backend/Dockerfile.ec2`
- **EC2 compose**: `docker-compose.ec2.yml`
- **Simple template**: `.env.ec2`
- **Setup guide**: `deploy/EC2-DEPLOYMENT-GUIDE.md`

### Database Management

#### Local Development
- **Clean all data**: `./clean_db.sh` (interactive with confirmation)
- **Clean keeping superusers**: `./clean_db.sh --keep-superuser`
- **Clean without confirmation**: `./clean_db.sh --confirm` (use with caution)
- **Django command**: `python manage.py clean_database [options]`

#### EC2 Production (Docker)
- **Clean database**: `./deploy/clean-db.sh` (from project root)
- **Skip confirmation**: `./deploy/clean-db.sh --confirm`
- **Docker command**: `docker-compose -f docker-compose.ec2.yml exec web python manage.py clean_database --confirm`
- **Populate test data**: `docker-compose -f docker-compose.ec2.yml exec web python manage.py populate_test_data`

The clean database scripts will:
- Delete ALL data from all tables
- Reset auto-increment counters (SQLite sequences)
- Preserve database structure (tables, indexes, etc.)
- Work in both local and Docker environments

### Environment Variables (Required)
Minimal configuration in `.env`:
- `DJANGO_SECRET_KEY`: Django secret key
- `EC2_PUBLIC_IP`: Your EC2 public IP
- `DOMAIN_NAME`: Your domain (optional)

## File Patterns
- **Backend models**: Each app has models.py, views.py, serializers.py, admin.py
- **Frontend pages**: Organized by domain with shared components
- **API endpoints**: RESTful design following DRF conventions
- **Deployment scripts**: All in `deploy/` directory