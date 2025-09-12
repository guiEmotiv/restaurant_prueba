# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Restaurant management system with Django backend and React frontend, using Django's built-in authentication system. The application handles orders, inventory, recipes, and kitchen operations for restaurants.

**This project is optimized for LOCAL DEVELOPMENT ONLY** - all production configurations have been removed.

## Development Commands

### Quick Start
```bash
./start-dev.sh          # Complete setup and start both servers
```

### Individual Commands
```bash
# Backend (Django)
cd backend/
source venv/bin/activate
python manage.py runserver 0.0.0.0:8000

# Frontend (React + Vite)
cd frontend/
npm run dev              # Development server with hot reload
npm run build            # Production build
npm run lint             # ESLint checking
npm run lint:fix         # Auto-fix linting issues
npm test                 # Jest tests
npm run test:watch       # Jest in watch mode
npm run test:coverage    # Jest with coverage report
```

### Django Management Commands
```bash
cd backend/
python manage.py migrate                    # Apply database migrations
python manage.py setup_groups              # Create user groups and permissions
python manage.py create_restaurant_users   # Create default restaurant users
python manage.py createsuperuser           # Create admin user
python manage.py shell                     # Django shell
python manage.py collectstatic             # Collect static files
```

## Architecture

### Backend Structure
- **Django 5.2** with Django REST Framework
- **SQLite** for development, configurable for PostgreSQL in production
- **Session-based authentication** with Django's built-in user system
- **Three main Django apps**:
  - `config/` - Basic configuration (units, zones, tables, containers)
  - `inventory/` - Inventory management (groups, ingredients, recipes)
  - `operation/` - Restaurant operations (orders, payments, kitchen)

### Frontend Structure
- **React 19** with Vite build system
- **TailwindCSS** for styling
- **Context API** for authentication state
- **Axios** for API communication
- **React Router** for navigation

### Key Directories
```
backend/
├── backend/
│   ├── settings/        # Environment-specific settings
│   ├── auth_views.py    # Authentication endpoints
│   └── urls.py          # Main URL routing + Excel import functions
├── config/              # Basic config models (Unit, Zone, Table, Container)
├── inventory/           # Inventory models (Group, Ingredient, Recipe)
├── operation/           # Operations models (Order, Payment, Kitchen)
└── data/               # SQLite database and logs

frontend/src/
├── components/
│   ├── auth/           # Login/logout components
│   ├── config/         # Configuration management UI
│   ├── inventory/      # Inventory management UI
│   ├── orders/         # Order management UI
│   └── common/         # Shared components
├── contexts/           # React contexts (AuthContext)
├── pages/              # Page-level components
│   ├── admin/          # Admin dashboard and management
│   └── operation/      # Kitchen and order operations
├── services/           # API service functions
└── hooks/              # Custom React hooks
```

## Authentication System

### User Roles and Permissions
The system uses Django groups for role-based access:
- **Administradores**: Full system access, configuration management
- **Gerentes**: Dashboard, inventory, order supervision
- **Meseros**: Order creation and table management
- **Cocineros**: Kitchen operations and order preparation
- **Cajeros**: Payment processing

### Default Users
- `admin/admin123` - Demo superuser
- `fernando/Theboss01@!` - Administrator
- `brayan/Mesero010@!` - Waiter example

### Authentication Flow
- Frontend uses session cookies for authentication
- CSRF protection enabled for state-changing operations
- API endpoints require authentication except health check and CSRF token

## API Structure

### Base URL: `http://localhost:8000/api/v1/`

### Authentication Endpoints
```
POST /api/v1/auth/login/     # Login
POST /api/v1/auth/logout/    # Logout
GET  /api/v1/auth/status/    # Current user status
GET  /api/v1/auth/users/     # User management (admin only)
```

### Main API Endpoints
- `/api/v1/config/` - Configuration management (units, zones, tables, containers)
- `/api/v1/inventory/` - Inventory management (groups, ingredients, recipes)
- `/api/v1/operation/` - Restaurant operations (orders, payments)

## Data Import System

The application includes Excel import functionality for bulk data management:

### Import Endpoints
```
POST /import-units/          # Import units
POST /import-zones/          # Import zones
POST /import-tables/         # Import tables (requires zones)
POST /import-containers/     # Import containers with prices
POST /import-groups/         # Import recipe groups
POST /import-ingredients/    # Import ingredients (requires units)
POST /import-recipes/        # Import recipes with ingredients
```

### Excel File Requirements
- **Units/Zones/Groups**: Simple `name` column
- **Tables**: `zone`, `table_number` columns
- **Containers**: `name`, `price`, optional `description`, `stock`
- **Ingredients**: `unit`, `name`, `unit_price`, optional `current_stock`
- **Recipes**: `name`, `group`, `container`, `profit_percentage`, `preparation_time`, `ingredient_1` through `ingredient_8` with corresponding `quantity_1` through `quantity_8`

## Database Relationships

### Key Model Dependencies
- `Ingredient` → `Unit` (foreign key)
- `Table` → `Zone` (foreign key)
- `Recipe` → `Group`, `Container` (foreign keys)
- `RecipeItem` → `Recipe`, `Ingredient` (foreign keys)
- `Order` → `Table`, `User` (foreign keys)
- `OrderItem` → `Order`, `Recipe` (foreign keys)

### Important Notes
- Excel imports delete existing data and reset SQLite sequences
- Foreign key constraints (PROTECT) require careful deletion order
- Recipe pricing is calculated automatically from ingredient costs + profit percentage

## Environment Configuration

### Development Settings
- SQLite database in `backend/data/restaurant.sqlite3`
- Debug mode enabled
- CORS allows all origins for development
- Detailed logging to console and files

### Environment Variables (.env)
```
DJANGO_SECRET_KEY=your-secret-key
DATABASE_NAME=restaurant.sqlite3
DATABASE_PATH=./backend/data
TIME_ZONE=America/Lima
LOCAL_IP=your-local-ip  # For network access
```

## Testing

### Backend Testing
```bash
cd backend/
python manage.py test  # Run Django tests
```

### Frontend Testing
```bash
cd frontend/
npm test               # Run Jest tests
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage
```

## Common Development Patterns

### Adding New API Endpoints
1. Create/update models in appropriate app (`config/`, `inventory/`, `operation/`)
2. Create serializers in `serializers.py`
3. Create viewsets in `views.py`
4. Add URL patterns in app's `urls.py`
5. Include in main `api_urls.py`

### Adding New Frontend Features
1. Create components in appropriate directory under `src/components/`
2. Add routing in `App.jsx` if needed
3. Create API service functions in `src/services/api.js`
4. Use `AuthContext` for authentication state
5. Follow existing patterns for error handling and loading states

### Permission Checking
Backend views use Django REST Framework permissions. Frontend components should check user roles via `AuthContext` and conditionally render UI elements.

## Production Considerations

- Change database to PostgreSQL
- Set `DEBUG=False` in production settings
- Configure proper CORS origins
- Set up static file serving
- Configure secure session cookies
- Set up proper logging and monitoring

## Troubleshooting

### Common Issues
- **"No module named 'django'"**: Activate virtual environment with `source backend/venv/bin/activate`
- **CSRF token missing**: Frontend must fetch CSRF token from `/csrf/` endpoint first
- **Connection refused**: Ensure both servers are running on correct ports (8000, 5173)
- **Import failures**: Check Excel file format and column names match requirements exactly
- **Foreign key constraints**: When deleting data, respect dependency order (operational data → recipes → ingredients → base config)