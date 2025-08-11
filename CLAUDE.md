# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
make test
pytest -q

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

## Deployment Notes

### Production Architecture
- **Frontend**: React SPA built with Vite, served by nginx
- **Backend**: Django REST API in Docker container
- **Proxy**: Nginx handles routing, CORS, SSL, and static files
- **Database**: SQLite for production simplicity
- **Domain**: https://www.xn--elfogndedonsoto-zrb.com

### Key Files
- `docker-compose.prod.yml`: Complete production setup with nginx + Django
- `nginx/conf.d/default.conf`: Nginx configuration with API routing
- `deploy/fix-api-complete.sh`: Complete deployment script
- Environment variables: `.env.ec2` (root), `backend/.env`, `frontend/.env.production`

### Deployment Commands
```bash
# Complete deployment (fixes API 404 errors)
sudo ./deploy/fix-api-complete.sh

# Manual steps if needed:
cd /opt/restaurant-web
sudo docker-compose -f docker-compose.prod.yml down
cd frontend && npm run build && cd ..
sudo docker-compose -f docker-compose.prod.yml up -d --build
```

### API Endpoints
- Health: `/api/v1/health/`
- Tables: `/api/v1/config/tables/`
- Recipes: `/api/v1/inventory/recipes/`
- Orders: `/api/v1/operation/orders/`
- Groups: `/api/v1/inventory/groups/`
- Containers: `/api/v1/config/containers/`

### Troubleshooting
- Check logs: `docker-compose -f docker-compose.prod.yml logs [web|nginx]`
- Test API direct: `curl http://localhost:8000/api/v1/health/`
- Test through nginx: `curl http://localhost/api/v1/health/`

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