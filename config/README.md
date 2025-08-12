# Configuration Management

This directory contains standardized environment configurations for the Restaurant Management System.

## Overview

The configuration system provides:
- **Standardized environment templates** for development, staging, and production
- **Automated configuration setup** via scripts
- **Secure configuration management** with proper file permissions
- **Environment-specific feature flags** and settings

## Directory Structure

```
config/
├── environments/
│   ├── development.env              # Backend development config
│   ├── staging.env                  # Backend staging config
│   ├── production.env               # Backend production config
│   ├── frontend-development.env     # Frontend development config
│   ├── frontend-staging.env         # Frontend staging config
│   └── frontend-production.env      # Frontend production config
└── README.md                        # This file
```

## Quick Start

### Automatic Configuration

Use the configuration script to set up your environment:

```bash
# Development environment
./scripts/configure-environment.sh development

# Staging environment
./scripts/configure-environment.sh staging

# Production environment
./scripts/configure-environment.sh production

# Backend only
./scripts/configure-environment.sh production --backend-only

# Frontend only
./scripts/configure-environment.sh development --frontend-only

# Force overwrite existing files
./scripts/configure-environment.sh development --force
```

### Manual Configuration

1. **Backend Configuration:**
   ```bash
   cp config/environments/development.env backend/.env
   # Edit backend/.env with your specific values
   ```

2. **Frontend Configuration:**
   ```bash
   # For development
   cp config/environments/frontend-development.env frontend/.env.local
   
   # For production
   cp config/environments/frontend-production.env frontend/.env.production
   ```

## Environment Variables

### Backend (Django)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `DJANGO_SECRET_KEY` | Django secret key for cryptographic signing | ✅ | - |
| `DEBUG` | Enable Django debug mode | ❌ | False |
| `ALLOWED_HOSTS` | Comma-separated list of allowed hostnames | ✅ | localhost |
| `DATABASE_URL` | Database connection string | ❌ | SQLite |
| `AWS_REGION` | AWS region for Cognito | ✅ | us-east-1 |
| `COGNITO_USER_POOL_ID` | AWS Cognito User Pool ID | ✅ | - |
| `COGNITO_APP_CLIENT_ID` | AWS Cognito App Client ID | ✅ | - |
| `TIME_ZONE` | Application timezone | ❌ | America/Lima |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins | ✅ | - |
| `LOG_LEVEL` | Logging level | ❌ | INFO |

### Frontend (React/Vite)

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_AWS_REGION` | AWS region for Cognito | ✅ | us-east-1 |
| `VITE_COGNITO_USER_POOL_ID` | AWS Cognito User Pool ID | ✅ | - |
| `VITE_COGNITO_APP_CLIENT_ID` | AWS Cognito App Client ID | ✅ | - |
| `VITE_API_BASE_URL` | Backend API base URL | ✅ | - |
| `VITE_REDIRECT_SIGN_IN` | Cognito sign-in redirect URL | ✅ | - |
| `VITE_REDIRECT_SIGN_OUT` | Cognito sign-out redirect URL | ✅ | - |
| `VITE_DEBUG_MODE` | Enable debug features | ❌ | false |
| `VITE_ENABLE_ANALYTICS` | Enable analytics tracking | ❌ | false |

## Environment-Specific Settings

### Development
- **Debug mode enabled**
- **Detailed logging**
- **Development tools enabled**
- **Local database (SQLite)**
- **Relaxed security settings**

### Staging
- **Production-like settings**
- **SSL enforcement**
- **Error reporting enabled**
- **Performance monitoring**
- **Staging domain configuration**

### Production
- **Maximum security settings**
- **SSL/HSTS enforced**
- **Error logging only**
- **Performance optimizations**
- **Monitoring and analytics enabled**

## Security Considerations

### File Permissions
- Environment files should have restrictive permissions: `chmod 600 .env`
- Never commit actual environment files to version control
- Use `.env.example` files for templates

### Secret Management
- Use strong, unique secret keys for each environment
- Rotate secrets regularly
- Consider using external secret management services for production

### Database Security
- Use strong passwords for database connections
- Enable SSL for database connections in production
- Restrict database access by IP when possible

## AWS Cognito Configuration

### Setting Up Cognito

1. **Create User Pool:**
   - Go to AWS Cognito Console
   - Create a new User Pool
   - Configure sign-in options (email recommended)
   - Set up user attributes as needed

2. **Create App Client:**
   - In your User Pool, create an App Client
   - Enable "Generate client secret" if needed
   - Configure OAuth flows and scopes

3. **Set Up User Groups:**
   ```
   - administradores (full access)
   - meseros (waiter access)
   - cocineros (kitchen access)
   ```

4. **Configure Redirect URLs:**
   - Add your application URLs to allowed callbacks
   - Development: `http://localhost:5173`
   - Production: `https://your-domain.com`

### Environment Configuration

Update your environment files with:
```bash
# Get from Cognito Console
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_APP_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1

# Configure redirects
VITE_REDIRECT_SIGN_IN=https://your-domain.com
VITE_REDIRECT_SIGN_OUT=https://your-domain.com
```

## Database Configuration

### SQLite (Default)
```bash
DATABASE_URL=sqlite:///db.sqlite3
```

### PostgreSQL
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
```

### Connection Pooling (Production)
```bash
CONN_MAX_AGE=600
DATABASE_CONN_MAX_AGE=600
```

## Monitoring and Logging

### Production Logging
```bash
LOG_LEVEL=WARNING
LOGGING_ROOT=/var/log/restaurant-app
```

### Error Tracking (Sentry)
```bash
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
VITE_SENTRY_DSN=https://your-frontend-sentry-dsn@sentry.io/project-id
```

### Analytics
```bash
VITE_ANALYTICS_ID=GA_MEASUREMENT_ID
VITE_ENABLE_ANALYTICS=true
```

## Troubleshooting

### Common Issues

1. **Cognito Authentication Fails:**
   - Verify User Pool ID and App Client ID
   - Check redirect URLs are correctly configured
   - Ensure user is in the correct group

2. **CORS Errors:**
   - Verify `CORS_ALLOWED_ORIGINS` includes frontend URL
   - Check API base URL configuration
   - Ensure protocol (http/https) matches

3. **Database Connection Issues:**
   - Verify `DATABASE_URL` format
   - Check database server is running
   - Verify credentials and permissions

4. **Build Failures:**
   - Check all required environment variables are set
   - Verify Vite environment variable names start with `VITE_`
   - Ensure no sensitive data in frontend environment variables

### Validation Commands

```bash
# Check backend configuration
cd backend && python manage.py check

# Check frontend configuration
cd frontend && npm run build

# Test environment script
./scripts/configure-environment.sh development --help
```

## Migration from Legacy Configuration

If upgrading from an existing setup:

1. **Backup existing files:**
   ```bash
   cp backend/.env backend/.env.backup
   cp frontend/.env frontend/.env.backup
   ```

2. **Use migration mode:**
   ```bash
   ./scripts/configure-environment.sh production --force
   ```

3. **Migrate custom settings:**
   - Compare backup files with new templates
   - Update new configuration with custom values
   - Test thoroughly before deploying

## Contributing

When adding new configuration options:

1. Update the appropriate template files
2. Document the new variables in this README
3. Update the validation script
4. Test with all environments
5. Update CI/CD workflows if needed