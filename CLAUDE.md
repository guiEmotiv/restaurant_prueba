# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev          # Start dev server on port 5173
npm run build        # Production build
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint errors
npm run test         # Run Jest tests
npm run test:watch   # Run tests in watch mode
npm run preview      # Preview production build
```

### Backend (Django + DRF)
```bash
cd backend
python manage.py runserver 0.0.0.0:8000  # Start dev server
python manage.py makemigrations           # Create migrations
python manage.py migrate                  # Apply migrations
python manage.py createsuperuser          # Create admin user
python manage.py collectstatic            # Collect static files
python manage.py test                     # Run Django tests
```

### Docker Development
```bash
# Use the docker manager script
./scripts/docker-manager.sh

# Manual Docker commands
docker-compose -f docker-compose.development.yml up -d
docker-compose -f docker-compose.development.yml down
```

## Architecture Overview

### Full-Stack Restaurant Management System
- **Frontend**: React 19 + Vite + TailwindCSS + AWS Amplify Auth
- **Backend**: Django 5.2 + Django REST Framework + AWS Cognito
- **Database**: SQLite (development) / PostgreSQL (production)
- **Authentication**: AWS Cognito User Pools with role-based permissions
- **Deployment**: Docker containers with production scripts

### Directory Structure
```
restaurant-web/
├── frontend/          # React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components by feature
│   │   ├── contexts/      # React contexts (Auth, Toast)
│   │   ├── services/      # API calls and external services
│   │   ├── utils/         # Utility functions
│   │   └── hooks/         # Custom React hooks
├── backend/           # Django application
│   ├── backend/           # Django project settings
│   │   └── settings/      # Modular settings (dev/prod)
│   ├── config/            # App configuration models
│   ├── inventory/         # Recipe and ingredient management
│   └── operation/         # Orders, payments, kitchen operations
├── scripts/           # Deployment and management scripts
├── data/             # SQLite database and uploads
└── docker/           # Docker configuration
```

### Key Backend Apps
- **config**: Restaurant configuration (tables, zones, containers, units)
- **inventory**: Recipe management, ingredients, groups, stock tracking
- **operation**: Order processing, payments, kitchen operations, dashboards

### Authentication System
- AWS Cognito integration with role-based permissions
- Configurable for development (can disable Cognito with `DEVELOPMENT_MODE=true`)
- Role-based routes: Admin, Kitchen, Cashier permissions
- Centralized in AuthContext with automatic token refresh

### Frontend Architecture
- **Component Structure**: Organized by feature with reusable components
- **State Management**: React Context for global state (Auth, Toast notifications)
- **Routing**: React Router with role-protected routes
- **Styling**: TailwindCSS with custom component library
- **API Integration**: Centralized Axios service with auth interceptors

### Environment Configuration
- **Centralized .env**: All environment variables in root `.env` file
- **Multi-environment**: Development/production settings via `ENVIRONMENT` variable
- **Vite Integration**: Frontend reads from root `.env` via vite.config.js
- **Docker Integration**: Environment-specific compose files

### Development Workflow
1. Copy `.env.example` to `.env` and configure variables
2. For rapid development without AWS: Set `USE_COGNITO_AUTH=false` and `DEVELOPMENT_MODE=true`
3. Frontend runs on port 5173, backend on 8000
4. Database migrations are automatically applied in development
5. Use `scripts/docker-manager.sh` for containerized development

### Production Deployment
- Automated deployment scripts in `scripts/prod/`
- Multi-stage Docker builds for optimized images
- Django settings split by environment
- Health checks and restart policies configured
- Nginx reverse proxy for production (configured but not used in dev)

### Database Models
- **Orders**: Complex order system with items, payments, status tracking
- **Recipes**: Multi-level ingredient system with cost calculation
- **Configuration**: Flexible restaurant setup (tables, zones, containers)
- **Permissions**: Role-based access control integrated with Cognito

### Special Features
- **Printer Integration**: Raspberry Pi printer support for kitchen orders
- **Real-time Updates**: SSE endpoints for live order tracking
- **Dashboard Analytics**: Financial and operational reporting
- **Excel Import/Export**: Bulk data management utilities
- **Mobile Responsive**: TailwindCSS responsive design throughout

## Important Notes
- Always run lint and type checking before committing changes
- Environment variables are centralized in root `.env` - no separate frontend `.env` needed
- Database migrations are managed in Django - use `makemigrations` and `migrate`
- Authentication can be disabled for development but NEVER in production
- Docker containers use volume mounts in development for hot reloading