# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend Development (React + Vite)
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start development server on port 5173
npm run build        # Build for production
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Backend Development (Django + DRF)
```bash
cd backend
python manage.py runserver 0.0.0.0:8000    # Start Django dev server
python manage.py migrate                    # Apply database migrations
python manage.py makemigrations            # Create new migrations
python manage.py test                      # Run tests
python manage.py populate_test_data        # Populate test data
python manage.py clean_database            # Clean database
```

### Docker Deployment
```bash
# Development
docker-compose up -d

# EC2 Production
docker-compose -f docker-compose.ec2.yml up -d
docker-compose -f docker-compose.ec2.yml logs web
docker-compose -f docker-compose.ec2.yml restart
```

### Deployment Scripts
```bash
sudo ./deploy/setup-initial.sh      # Initial EC2 setup
sudo ./deploy/build-deploy.sh       # Build and deploy
sudo ./deploy/debug-cognito-permissions.sh  # Debug auth issues
```

## Architecture

### Stack Overview
- **Frontend**: React 19 + Vite + Tailwind CSS + AWS Amplify (Auth)
- **Backend**: Django 5.2 + Django REST Framework 3.16
- **Database**: SQLite (development and production)
- **Authentication**: AWS Cognito with JWT tokens
- **Deployment**: Docker + Nginx on EC2

### Project Structure
```
restaurant-web/
├── frontend/           # React SPA
│   ├── src/
│   │   ├── components/ # Reusable UI components
│   │   ├── contexts/   # React contexts (Auth, Toast)
│   │   ├── pages/      # Page components by module
│   │   └── services/   # API client
│   └── dist/          # Production build
├── backend/           # Django REST API
│   ├── config/        # Restaurant configuration (tables, zones, units)
│   ├── inventory/     # Ingredients and recipes
│   ├── operation/     # Orders and payments
│   └── backend/       # Django settings and auth middleware
└── deploy/           # Deployment scripts
```

### Key API Endpoints
- `/api/v1/health/` - Health check (no auth required)
- `/api/v1/units/` - Measurement units
- `/api/v1/zones/` - Restaurant zones
- `/api/v1/tables/` - Tables management
- `/api/v1/waiters/` - Waiters management
- `/api/v1/groups/` - Ingredient groups
- `/api/v1/ingredients/` - Ingredients inventory
- `/api/v1/recipes/` - Recipe management
- `/api/v1/orders/` - Order processing
- `/api/v1/payments/` - Payment handling

### Authentication Flow
1. Frontend uses AWS Amplify to authenticate with Cognito
2. JWT token sent in Authorization header: `Bearer <token>`
3. Backend middleware validates JWT and extracts user groups
4. Permissions based on Cognito groups:
   - `administradores`: Full access
   - `meseros`: Orders and payments access
   - `cocineros`: Kitchen view access

### Important Files
- `frontend/src/config/amplify.js` - AWS Cognito configuration
- `backend/backend/cognito_auth.py` - JWT validation middleware
- `backend/backend/cognito_permissions.py` - Role-based permissions
- `frontend/src/services/api.js` - API client with auth headers

### Environment Variables
Frontend production (`frontend/.env.production`):
- `VITE_API_URL` - Backend API URL
- `VITE_COGNITO_USER_POOL_ID` - AWS Cognito User Pool ID
- `VITE_COGNITO_CLIENT_ID` - AWS Cognito App Client ID
- `VITE_AWS_REGION` - AWS region

Backend (`backend/.env`):
- `DJANGO_SECRET_KEY` - Django secret key
- `DEBUG` - Debug mode (0/1)
- `ALLOWED_HOSTS` - Comma-separated allowed hosts
- `COGNITO_USER_POOL_ID` - AWS Cognito User Pool ID
- `COGNITO_APP_CLIENT_ID` - AWS Cognito App Client ID
- `AWS_REGION` - AWS region

### Database Schema
The system uses three main Django apps:
1. **config**: Restaurant setup (zones, tables, units, waiters)
2. **inventory**: Ingredients and recipes management
3. **operation**: Order processing and payments

Relationships follow a hierarchical structure where orders contain items, items reference recipes, and recipes contain ingredients with specific quantities.