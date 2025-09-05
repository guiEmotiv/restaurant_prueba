# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a full-stack restaurant management web application with:
- **Frontend**: React (Vite) with Tailwind CSS, AWS Amplify authentication, located in `frontend/`
- **Backend**: Django REST API with SQLite database, located in `backend/`
- **Deployment**: Docker-based production deployment with multiple deployment scripts

## Development Commands

### Frontend Development (run from `frontend/` directory)
- **Development server**: `npm run dev` (runs on port 5173)
- **Build**: `npm run build` or `npm run build:prod` (production)
- **Linting**: `npm run lint` or `npm run lint:fix`
- **Testing**: `npm test`, `npm run test:watch`, `npm run test:coverage`
- **Clean rebuild**: `npm run reset`

### Backend Development (run from `backend/` directory)  
- **Development server**: `python manage.py runserver`
- **Database migrations**: `python manage.py makemigrations` then `python manage.py migrate`
- **Django shell**: `python manage.py shell`
- **Admin superuser**: `python manage.py createsuperuser`
- **Database checks**: `python manage.py check`
- **Reset data**: `python manage.py clean_database` or `python manage.py reset_operational_data`

### Production Deployment
- **Main deployment**: `./deploy/enterprise-deploy.sh` (comprehensive deployment script)
- **Alternative scripts**: Various scripts in `scripts/` directory for specific deployment scenarios
- **Docker build**: Uses `Dockerfile.prod` for multi-stage production builds

## Architecture Overview

### Backend (Django)
- **Main app**: `operation/` - Contains models, views, serializers for restaurant operations
- **Config app**: `config/` - System configuration and management commands  
- **Key models**: Tables, orders, menu items, users, financial tracking
- **API views**: Separate views for operational (`views_operativo.py`) and financial (`views_financiero.py`) concerns
- **SSE support**: Real-time updates via `sse_views.py`
- **Database**: SQLite with comprehensive migration history

### Frontend (React)
- **Authentication**: AWS Cognito integration via Amplify (`contexts/AuthContext.jsx`)
- **Styling**: Tailwind CSS with custom components
- **State management**: React Context for auth and toast notifications
- **Key directories**:
  - `components/` - Reusable UI components
  - `contexts/` - Global state management
  - `utils/` - Utility functions including Bluetooth, Excel import, dashboard utils
  - `config/` - Configuration files for Amplify and printer setup

### Key Features
- **Restaurant POS system**: Order management, table management, menu configuration
- **Real-time updates**: Server-sent events for live order status updates
- **Financial reporting**: Dashboard with analytics and reporting capabilities
- **Bluetooth printing**: Integration for receipt printing
- **AWS Cognito auth**: User authentication and authorization
- **Excel import/export**: Bulk data operations

## Important Development Notes

- The project uses environment variables for AWS Cognito configuration
- Database migrations have a complex history - be careful when creating new migrations
- The frontend has specific build configurations for development vs production environments
- Deployment scripts are comprehensive and handle database migrations, Docker builds, and EC2 deployment
- Tests are configured with Jest for frontend and Django's built-in testing for backend
- The application supports both development and production modes with different authentication configurations

## Database Management

- Primary database: `db.sqlite3` in backend directory
- Migration management is critical - always test migrations in development first
- Use management commands for data cleanup and reset operations
- The app includes complex financial views and operational dashboards that depend on specific data structures

## AWS Integration

- Uses AWS Cognito for authentication
- Environment variables control Cognito configuration
- Can be deployed with or without Cognito depending on VITE_DISABLE_COGNITO setting
- Production deployment includes proper AWS configuration handling