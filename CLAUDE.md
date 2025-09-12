# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a restaurant management web application with a Django REST API backend and React frontend, designed to handle orders, inventory, and printer integration.

**Core Structure:**
- `backend/` - Django REST API with modular settings
- `frontend/` - React + Vite application with TailwindCSS
- `docker/` - Container configuration for deployment
- `scripts/` - Development and deployment automation
- `data/` - Persistent data storage

**Key Django Apps:**
- `operation/` - Order management and printer queue functionality
- `inventory/` - Stock and product management
- `config/` - Application configuration and settings

**Authentication:** AWS Cognito integration with fallback to Django authentication (configurable via `USE_COGNITO_AUTH` environment variable)

## Development Commands

**Frontend (from `frontend/`):**
```bash
npm run dev          # Start development server (port 5173)
npm run build        # Production build
npm run lint         # ESLint
npm run lint:fix     # Auto-fix lint issues
npm run test         # Jest tests
npm run test:watch   # Watch mode tests
npm run test:coverage # Coverage report
```

**Backend (from `backend/`):**
```bash
python manage.py runserver     # Start development server (port 8000)
python manage.py migrate       # Apply database migrations
python manage.py test         # Run Django tests
python manage.py shell        # Django shell
python manage.py collectstatic # Collect static files
```

**Docker Development:**
```bash
docker-compose -f docker-compose.development.yml up  # Start dev environment
```

**Docker Production:**
```bash
docker-compose -f docker-compose.production.yml up   # Start production environment
```

**Quick Development Setup:**
```bash
./scripts/dev/start-dev.sh     # Automated local development setup
```

## Environment Configuration

- Copy `.env.example` to `.env` for development
- Use `.env.production` for production deployment
- Key variables: `ENVIRONMENT`, `DJANGO_SECRET_KEY`, `USE_COGNITO_AUTH`, AWS Cognito settings

## Testing

- Frontend: Jest with React Testing Library
- Backend: Django's built-in test framework
- Run `python test_label_format_simple.py` for printer functionality testing

## Deployment

The application supports containerized deployment with:
- Nginx reverse proxy with SSL support
- Static file serving
- Health checks for both services
- Production-optimized Django settings

## Key Patterns

- Django uses modular settings architecture (`backend/backend/settings/`)
- React components follow standard patterns with hooks
- API endpoints are centralized in `backend/api_urls.py`
- Printer integration handled through dedicated models and views