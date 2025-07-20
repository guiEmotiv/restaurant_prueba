# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Local Development (Make targets)
- `make run` - Start Django development server on 0.0.0.0:8000
- `make migrate` - Apply database migrations  
- `make test` - Run tests with pytest
- `make coverage` - Run pytest with coverage
- `make shell` - Open Django shell (shell_plus preferred, falls back to shell)
- `make createsuperuser` - Create Django admin superuser

### Docker Development
- `docker-compose up web` - Start web service
- `docker-compose up -d db` - Start PostgreSQL database only
- `docker-compose exec web python manage.py migrate` - Run migrations in container
- `docker-compose exec web python manage.py createsuperuser` - Create superuser in container
- `docker-compose exec web python manage.py collectstatic` - Collect static files

### Dependencies
- `make init` - Install dependencies from requirements-dev.txt
- `make deps` - Compile requirements files using pip-compile
- `make audit` - Run security audit with pip-audit

### Frontend Development (React 19)
- `cd frontend && npm install` - Install frontend dependencies
- `cd frontend && npm run dev` - Start React development server on localhost:5173
- `cd frontend && npm run build` - Build for production
- `cd frontend && npm run preview` - Preview production build

## Architecture

### Project Structure
Django REST API for restaurant management with three main apps:

1. **config** - Basic configuration models (categories, units, zones, tables)
2. **inventory** - Ingredients, recipes, and recipe items with stock management
3. **operation** - Orders, order items, customizations, and payments

### Key Models & Relationships

**Config App:**
- `Category` → `Ingredient` (one-to-many)
- `Unit` → `Ingredient` (one-to-many) 
- `Zone` → `Table` (one-to-many)

**Inventory App:**
- `Recipe` → `RecipeItem` → `Ingredient` (recipe composition)
- Stock tracking with automatic price calculation
- Ingredient consumption tracking

**Operation App:**
- `Table` → `Order` → `OrderItem` → `Recipe`
- `OrderItem` → `OrderItemIngredient` (customizations)
- `Order` → `Payment` (one-to-one)

### Database
- PostgreSQL 17 with custom table names (no `app_` prefix)
- Uses environment variables from `.env` file
- Docker setup with health checks

### API Structure
- REST API with DRF ViewSets
- API docs at `/api/docs/` (Swagger UI)
- Schema at `/api/schema/`
- All endpoints under `/api/v1/`

### Key Business Logic
- Automatic stock consumption when orders are created
- Stock restoration when orders are cancelled
- Dynamic price calculation including customizations
- Order status flow: CREATED → SERVED → PAID
- Protected deletion with relationship validation

### Settings
- Spanish locale (es-pe) with Lima timezone
- Token authentication enabled
- CORS configured for localhost:3000 (React frontend)
- AllowAny permissions (development mode)

## Frontend Architecture

### Technology Stack
- React 19 with Vite build tool
- Tailwind CSS for styling (mobile-first responsive design)
- React Router DOM for navigation
- Axios for API communication
- Lucide React for icons

### Project Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── common/          # Reusable UI components
│   │   ├── orders/          # Order-specific components
│   │   └── recipes/         # Recipe-specific components
│   ├── pages/
│   │   ├── config/          # Configuration CRUD pages
│   │   ├── inventory/       # Inventory management pages
│   │   └── operation/       # Order management pages
│   └── services/
│       └── api.js           # API service layer
```

### Key Features
- **Responsive Design**: Mobile-first approach with collapsible sidebar
- **CRUD Operations**: Complete Create, Read, Update, Delete for all models
- **Business Logic**: Stock tracking, order workflow, payment processing
- **Real-time Updates**: Dashboard with statistics and low stock alerts
- **Order Management**: Full order lifecycle from creation to payment