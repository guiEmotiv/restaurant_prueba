"""
Django Base Settings - Common configuration for all environments
Python 3.12 · Django 5.2 · DRF 3.16
"""
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env

# Build paths inside the project
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # backend/ directory

# ──────────────────────────────────────────────────────────────
# Core Settings
# ──────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "django-insecure-dev-key-change-in-production")

# Debug is set per environment
DEBUG = False  # Override in development.py

# Hosts configuration
ALLOWED_HOSTS = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")

# ──────────────────────────────────────────────────────────────
# AWS Cognito Configuration (REQUIRED - No bypass)
# ──────────────────────────────────────────────────────────────

# AWS Configuration
AWS_REGION = os.getenv("AWS_REGION", "us-west-2")

# Cognito Configuration - ALWAYS REQUIRED
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "us-west-2_bdCwF60ZI")
COGNITO_APP_CLIENT_ID = os.getenv("COGNITO_APP_CLIENT_ID", "4i9hrd7srgbqbtun09p43ncfn0")

# Cognito configuration - Environment aware
USE_COGNITO_AUTH = os.getenv('USE_COGNITO_AUTH', 'true').lower() == 'true'
COGNITO_ENABLED = USE_COGNITO_AUTH

# Development bypass option (only for local development)
DEVELOPMENT_MODE = os.getenv('DEVELOPMENT_MODE', 'false').lower() == 'true'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# ──────────────────────────────────────────────────────────────
# Apps
# ──────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    # Core Django
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "drf_spectacular",
    
    # Restaurant Apps
    "config",
    "inventory", 
    "operation",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# AWS Cognito middleware - only if enabled
if COGNITO_ENABLED:
    auth_index = MIDDLEWARE.index("django.contrib.auth.middleware.AuthenticationMiddleware")
    MIDDLEWARE.insert(auth_index + 1, "backend.cognito_auth.CognitoAuthenticationMiddleware")

ROOT_URLCONF  = "backend.urls"
WSGI_APPLICATION = "backend.wsgi.application"
ASGI_APPLICATION = "backend.asgi.application"

# ──────────────────────────────────────────────────────────────
# Base de datos PostgreSQL 17
# Usa múltiples esquemas y fija el search_path.
# ──────────────────────────────────────────────────────────────
# ──────────────────────────────────────────────────────────────
# Database - Override in environment-specific settings
# ──────────────────────────────────────────────────────────────
# Database configuration is environment-specific
# Override in development.py or production.py

# ──────────────────────────────────────────────────────────────
# Internacionalización
# ──────────────────────────────────────────────────────────────
LANGUAGE_CODE = "es-pe"
TIME_ZONE     = os.getenv("TIME_ZONE", "America/Lima")
USE_I18N = True
USE_TZ   = True

# ──────────────────────────────────────────────────────────────
# Ficheros estáticos
# ──────────────────────────────────────────────────────────────
STATIC_URL  = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ──────────────────────────────────────────────────────────────
# Django REST Framework
# ──────────────────────────────────────────────────────────────
# DRF Configuration - Environment aware
REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

# Authentication configuration based on environment
if COGNITO_ENABLED:
    REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"] = [
        "rest_framework.permissions.IsAuthenticated",  # AWS Cognito authentication REQUIRED
    ]
    REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"] = [
        "backend.cognito_drf_auth.CognitoJWTAuthentication",  # AWS Cognito JWT validation
    ]
else:
    # Development mode - allow unauthenticated access
    REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"] = [
        "rest_framework.permissions.AllowAny",  # Development mode - no auth required
    ]
    REST_FRAMEWORK["DEFAULT_AUTHENTICATION_CLASSES"] = [
        "rest_framework.authentication.SessionAuthentication",  # Basic session auth for admin
    ]

# Authentication classes are ALWAYS enabled

# ──────────────────────────────────────────────────────────────
# CORS Configuration
# ──────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",  # Vite development server
    "http://127.0.0.1:5173",
    "http://192.168.1.35:5173",  # Local network IP
]

# Allow all origins in development for easier testing
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True

# Add EC2 IP to CORS if configured
EC2_IP = os.getenv('EC2_PUBLIC_IP', '')
if EC2_IP:
    CORS_ALLOWED_ORIGINS.append(f"http://{EC2_IP}")

# Add domain to CORS if configured
DOMAIN_NAME = os.getenv('DOMAIN_NAME', '')
if DOMAIN_NAME:
    CORS_ALLOWED_ORIGINS.extend([
        f"https://{DOMAIN_NAME}",
        f"https://www.{DOMAIN_NAME}",
        f"http://{DOMAIN_NAME}",
        f"http://www.{DOMAIN_NAME}",
    ])

CORS_ALLOW_CREDENTIALS = True

# CSRF Configuration for development
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",  # Vite development server
    "http://127.0.0.1:5173",
    "http://192.168.1.35:5173",  # Local network IP
]

# Add domain to CSRF if configured
if DOMAIN_NAME:
    CSRF_TRUSTED_ORIGINS.extend([
        f"https://{DOMAIN_NAME}",
        f"https://www.{DOMAIN_NAME}",
    ])

# CSRF Cookie settings for frontend
CSRF_COOKIE_NAME = 'csrftoken'
CSRF_COOKIE_HTTPONLY = False  # Allow JavaScript access
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = not DEBUG  # Use secure cookies in production
CSRF_USE_SESSIONS = False  # Use cookies instead of sessions

# Allow specific headers including 'Expires'
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'expires',  # lowercase version
    'Expires',  # uppercase version - this is what the frontend sends
    'cache-control',
    'pragma',
]


# ──────────────────────────────────────────────────────────────
# AWS Cognito Configuration
# ──────────────────────────────────────────────────────────────
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
COGNITO_USER_POOL_ID = os.getenv('COGNITO_USER_POOL_ID', '')
COGNITO_APP_CLIENT_ID = os.getenv('COGNITO_APP_CLIENT_ID', '')

# Enable Cognito authentication - Use USE_COGNITO_AUTH as single source of truth
# COGNITO_ENABLED is already set earlier from USE_COGNITO_AUTH (line 37)
# Do NOT override it based on presence of credentials

# Validate that if Cognito is enabled, credentials are provided
# Validate Cognito credentials - only if enabled
if COGNITO_ENABLED:
    if not COGNITO_USER_POOL_ID or not COGNITO_APP_CLIENT_ID:
        print("❌ CRITICAL: Cognito credentials are missing!")
        print("  COGNITO_USER_POOL_ID:", "Set" if COGNITO_USER_POOL_ID else "Missing")
        print("  COGNITO_APP_CLIENT_ID:", "Set" if COGNITO_APP_CLIENT_ID else "Missing")
        raise ValueError("AWS Cognito credentials are required when COGNITO_ENABLED=True")
    else:
        print(f"✅ AWS Cognito authentication ENABLED - User Pool: {COGNITO_USER_POOL_ID[:10]}...")
else:
    print("⚠️  AWS Cognito authentication DISABLED - Development mode active")


# ──────────────────────────────────────────────────────────────
# API Documentation (drf-spectacular)
# ──────────────────────────────────────────────────────────────
SPECTACULAR_SETTINGS = {
    "TITLE": "Restaurant Management API",
    "DESCRIPTION": "API completa para la gestión de restaurantes",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# ──────────────────────────────────────────────────────────────
# Rate Limiting Configuration
# ──────────────────────────────────────────────────────────────

# NO RATE LIMITING - AWS Cognito handles authentication, unlimited requests
# Cache configuration for Django sessions only
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'default-cache',
        'OPTIONS': {
            'MAX_ENTRIES': 1000,
        }
    }
}

# Logging configuration
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'data' / 'logs' / 'django.log',
            'formatter': 'verbose',
        },
        'console': {
            'level': 'WARNING',
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['file'],
            'level': 'WARNING',
            'propagate': True,
        },
    },
}